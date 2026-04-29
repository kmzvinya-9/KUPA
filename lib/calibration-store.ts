import fs from "fs"
import path from "path"

const CALIBRATION_FILE = path.join(process.cwd(), "data", "calibration.json")

export type CalibrationState = {
  phOffset: number
  turbidityClearVoltage: number
  turbidityDirtyVoltage: number
  colorBaselineR: number
  colorBaselineG: number
  colorBaselineB: number
  colorBaselineReady: boolean
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
  lastUpdated: new Date().toISOString(),
}

function ensureDataDir() {
  const dataDir = path.join(process.cwd(), "data")
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
}

export function getCalibrationState(): CalibrationState {
  try {
    ensureDataDir()
    if (fs.existsSync(CALIBRATION_FILE)) {
      const data = fs.readFileSync(CALIBRATION_FILE, "utf8")
      return JSON.parse(data) as CalibrationState
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
    fs.writeFileSync(CALIBRATION_FILE, JSON.stringify(updated, null, 2))
    return updated
  } catch (error) {
    console.error("Error saving calibration state:", error)
    return DEFAULT_CALIBRATION
  }
}

export function resetCalibrationState(): CalibrationState {
  return saveCalibrationState({ ...DEFAULT_CALIBRATION })
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
    fs.writeFileSync(historyFile, JSON.stringify(trimmed, null, 2))
  } catch (error) {
    console.error("Error writing calibration history:", error)
  }
}