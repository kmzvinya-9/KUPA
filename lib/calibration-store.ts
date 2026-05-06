import fs from "fs"
import path from "path"

const CALIBRATION_FILE = path.join(process.cwd(), "data", "calibration.json")
const CALIBRATION_COMMAND_FILE = path.join(process.cwd(), "data", "calibration-command.json")
const CALIBRATION_COMMAND_TIMEOUT_MS = 30_000

export const CALIBRATION_COMMANDS = [
  "status",
  "cal ph7",
  "cal turbidity-clear",
  "cal turbidity-dirty",
  "cal color",
  "cal tank-empty",
  "cal tank-full",
  "cal temperature",
  "cal all",
  "cal reset",
] as const

export type CalCommand = (typeof CALIBRATION_COMMANDS)[number]

export type CalibrationCommandState = {
  id: string
  command: CalCommand
  calibration?: Partial<CalibrationState>
  status: "pending" | "sent" | "completed" | "failed"
  requestedAt: string
  updatedAt: string
  sentAt?: string
  completedAt?: string
  deviceId?: string
  ok?: boolean
  message?: string
}

export type CalibrationState = {
  phOffset: number
  turbidityClearVoltage: number
  turbidityDirtyVoltage: number
  colorBaselineR: number
  colorBaselineG: number
  colorBaselineB: number
  colorBaselineReady: boolean
  tankEmptyDistanceCm: number
  tankFullDistanceCm: number
  temperatureOffsetC: number
  lastUpdated: string
}

const DEFAULT_CALIBRATION: CalibrationState = {
  phOffset: 7.0,
  turbidityClearVoltage: 3.3,
  turbidityDirtyVoltage: 0.0,
  colorBaselineR: 255.0,
  colorBaselineG: 255.0,
  colorBaselineB: 255.0,
  colorBaselineReady: false,
  tankEmptyDistanceCm: 13.0,
  tankFullDistanceCm: 3.0,
  temperatureOffsetC: 0.0,
  lastUpdated: new Date().toISOString(),
}

export function isCalibrationCommand(value: unknown): value is CalCommand {
  return typeof value === "string" && CALIBRATION_COMMANDS.includes(value as CalCommand)
}

function ensureDataDir() {
  const dataDir = path.join(process.cwd(), "data")
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
}

function writeJsonFileAtomic(filePath: string, value: unknown) {
  ensureDataDir()
  const tmpFile = `${filePath}.${process.pid}.tmp`
  fs.writeFileSync(tmpFile, JSON.stringify(value, null, 2))
  fs.renameSync(tmpFile, filePath)
}

export function getCalibrationState(): CalibrationState {
  try {
    ensureDataDir()
    if (fs.existsSync(CALIBRATION_FILE)) {
      const data = fs.readFileSync(CALIBRATION_FILE, "utf8")
      return {
        ...DEFAULT_CALIBRATION,
        ...(JSON.parse(data) as Partial<CalibrationState>),
      }
    }
  } catch (error) {
    console.error("Error reading calibration state:", error)
  }
  return DEFAULT_CALIBRATION
}

export function saveCalibrationState(state: Partial<CalibrationState>): CalibrationState {
  try {
    ensureDataDir()
    const current = getCalibrationState()
    const updated = {
      ...current,
      ...state,
      lastUpdated: new Date().toISOString(),
    }
    writeJsonFileAtomic(CALIBRATION_FILE, updated)
    return updated
  } catch (error) {
    console.error("Error saving calibration state:", error)
    return DEFAULT_CALIBRATION
  }
}

export function resetCalibrationState(): CalibrationState {
  return saveCalibrationState({ ...DEFAULT_CALIBRATION })
}

function readCalibrationCommandState(): CalibrationCommandState | null {
  try {
    ensureDataDir()
    if (!fs.existsSync(CALIBRATION_COMMAND_FILE)) return null
    const data = fs.readFileSync(CALIBRATION_COMMAND_FILE, "utf8")
    if (!data.trim()) return null
    const state = JSON.parse(data) as CalibrationCommandState
    if ((state.status === "pending" || state.status === "sent") && Date.now() - new Date(state.requestedAt).getTime() > CALIBRATION_COMMAND_TIMEOUT_MS) {
      return writeCalibrationCommandState({
        ...state,
        status: "failed",
        ok: false,
        message: "ESP32 did not respond to the calibration command within 30 seconds.",
        updatedAt: new Date().toISOString(),
      })
    }
    return state
  } catch (error) {
    console.error("Error reading calibration command state:", error)
    return null
  }
}

function writeCalibrationCommandState(state: CalibrationCommandState): CalibrationCommandState {
  writeJsonFileAtomic(CALIBRATION_COMMAND_FILE, state)
  return state
}

export function getCalibrationCommandState(): CalibrationCommandState | null {
  return readCalibrationCommandState()
}

export function queueCalibrationCommand(command: CalCommand, calibration?: Partial<CalibrationState>): CalibrationCommandState {
  const now = new Date().toISOString()
  return writeCalibrationCommandState({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    command,
    calibration,
    status: "pending",
    requestedAt: now,
    updatedAt: now,
    message: "Waiting for ESP32 to collect this calibration command.",
  })
}

export function takePendingCalibrationCommand(deviceId: string): CalibrationCommandState | null {
  const current = readCalibrationCommandState()
  if (!current || current.status !== "pending") return null

  const now = new Date().toISOString()
  return writeCalibrationCommandState({
    ...current,
    status: "sent",
    sentAt: now,
    updatedAt: now,
    deviceId,
    message: "Command sent to ESP32. Waiting for calibration response.",
  })
}

export function completeCalibrationCommand(commandId: string, ok: boolean, message: string): CalibrationCommandState | null {
  const current = readCalibrationCommandState()
  if (!current || current.id !== commandId) return null

  const now = new Date().toISOString()
  return writeCalibrationCommandState({
    ...current,
    status: ok ? "completed" : "failed",
    ok,
    message,
    completedAt: now,
    updatedAt: now,
  })
}

export function getCalibrationHistory(): Array<{ timestamp: string; action: string; values: Partial<CalibrationState> }> {
  const historyFile = path.join(process.cwd(), "data", "calibration-history.json")
  try {
    if (fs.existsSync(historyFile)) {
      const data = fs.readFileSync(historyFile, "utf8")
      return JSON.parse(data) as Array<{ timestamp: string; action: string; values: Partial<CalibrationState> }>
    }
  } catch (error) {
    console.error("Error reading calibration history:", error)
  }
  return []
}

export function addCalibrationHistoryEntry(action: string, values: Partial<CalibrationState>) {
  const historyFile = path.join(process.cwd(), "data", "calibration-history.json")
  try {
    ensureDataDir()
    const history = getCalibrationHistory()
    history.push({
      timestamp: new Date().toISOString(),
      action,
      values,
    })
    // Keep only last 100 entries
    const trimmed = history.slice(-100)
    writeJsonFileAtomic(historyFile, trimmed)
  } catch (error) {
    console.error("Error writing calibration history:", error)
  }
}
