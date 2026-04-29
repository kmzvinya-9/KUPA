import fs from 'node:fs'
import path from 'node:path'

export type ScreeningStatus = 'low' | 'moderate' | 'high'
export type FlowSensorState = 'active' | 'idle' | 'no_water' | 'unknown'

export type TelemetryRecord = {
  recordId: string
  deviceId: string
  timestamp: string
  receivedAt: number
  hasWater: boolean
  temperatureC: number
  ph: number
  turbidityPercent: number
  flowRateLMin: number
  tankLevelPercent: number
  tankCapacity: number
  colorR: number
  colorG: number
  colorB: number
  lux: number
  batteryLevel: number
  batteryVoltage: number
  isCharging: boolean
  pulseCount: number
  sdCardActive: boolean
  sdCardWriting: boolean
  sdCardUsage: number
  uptimeSeconds: number
  temperatureSensorOk: boolean
  phSensorOk: boolean
  turbiditySensorOk: boolean
  ultrasonicSensorOk: boolean
  colorSensorOk: boolean
  flowSensorState: FlowSensorState
  sensorsForcedOff: boolean
  phVoltage: number
  turbidityVoltage: number
  screeningScore: number
  screeningStatus: ScreeningStatus
  screeningSummary: string
}

type TelemetryStore = {
  latest: TelemetryRecord | null
  records: TelemetryRecord[]
  ids: Set<string>
  loadedFromDisk: boolean
}

declare global {
  // eslint-disable-next-line no-var
  var __esp32TelemetryStore__: TelemetryStore | undefined
}

const MAX_RECORDS = 20000
const TELEMETRY_DIR = path.join(process.cwd(), 'data')
const TELEMETRY_HISTORY_FILE = path.join(TELEMETRY_DIR, 'telemetry-history.jsonl')
const TELEMETRY_LATEST_FILE = path.join(TELEMETRY_DIR, 'telemetry-latest.json')

function createEmptyStore(): TelemetryStore {
  return {
    latest: null,
    records: [],
    ids: new Set<string>(),
    loadedFromDisk: false,
  }
}

function getRecordIdentity(record: Pick<TelemetryRecord, 'recordId' | 'deviceId' | 'timestamp'>) {
  return record.recordId || `${record.deviceId}:${record.timestamp}`
}

function ensurePersistenceLoaded(store: TelemetryStore) {
  if (store.loadedFromDisk) return
  store.loadedFromDisk = true

  try {
    fs.mkdirSync(TELEMETRY_DIR, { recursive: true })

    if (fs.existsSync(TELEMETRY_HISTORY_FILE)) {
      try {
        const content = fs.readFileSync(TELEMETRY_HISTORY_FILE, 'utf8')
        const lines = content
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)

        for (const line of lines.slice(-MAX_RECORDS)) {
          try {
            const parsed = JSON.parse(line) as TelemetryRecord
            const identity = getRecordIdentity(parsed)
            if (store.ids.has(identity)) continue
            store.records.push(parsed)
            store.ids.add(identity)
          } catch {
            // ignore invalid history line
          }
        }
      } catch {
        // ignore file read errors
      }
    }

    if (fs.existsSync(TELEMETRY_LATEST_FILE)) {
      try {
        const content = fs.readFileSync(TELEMETRY_LATEST_FILE, 'utf8')
        if (content && content.trim()) {
          const latest = JSON.parse(content) as TelemetryRecord
          store.latest = latest
          store.ids.add(getRecordIdentity(latest))
          if (!store.records.some((record) => getRecordIdentity(record) === getRecordIdentity(latest))) {
            store.records = [...store.records.slice(-(MAX_RECORDS - 1)), latest]
          }
        }
      } catch {
        // ignore invalid latest file
      }
    }

    if (!store.latest && store.records.length > 0) {
      store.latest = store.records[store.records.length - 1]
    }
  } catch {
    // keep in-memory fallback alive even if disk persistence is unavailable
  }
}

function persistLatest(record: TelemetryRecord) {
  try {
    fs.mkdirSync(TELEMETRY_DIR, { recursive: true })
    fs.writeFileSync(TELEMETRY_LATEST_FILE, JSON.stringify(record, null, 2))
  } catch {
    // ignore persistence errors
  }
}

function compactHistoryFile(records: TelemetryRecord[]) {
  try {
    fs.mkdirSync(TELEMETRY_DIR, { recursive: true })
    const body = records.map((record) => JSON.stringify(record)).join('\n')
    fs.writeFileSync(TELEMETRY_HISTORY_FILE, body ? `${body}\n` : '')
  } catch {
    // ignore persistence errors
  }
}

function appendHistoryRecord(record: TelemetryRecord) {
  try {
    fs.mkdirSync(TELEMETRY_DIR, { recursive: true })
    fs.appendFileSync(TELEMETRY_HISTORY_FILE, `${JSON.stringify(record)}\n`)
  } catch {
    // ignore persistence errors
  }
}

export function getTelemetryStore(): TelemetryStore {
  if (!globalThis.__esp32TelemetryStore__) {
    globalThis.__esp32TelemetryStore__ = createEmptyStore()
  }

  const store = globalThis.__esp32TelemetryStore__
  ensurePersistenceLoaded(store)
  return store
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function sanitizeInt(value: unknown, min = 0, max = 255) {
  return Math.round(clamp(toFiniteNumber(value), min, max))
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false
  }
  return fallback
}

function toFlowSensorState(value: unknown, hasWater: boolean, flowRateLMin: number): FlowSensorState {
  if (typeof value === 'string') {
    if (value === 'active' || value === 'idle' || value === 'no_water' || value === 'unknown') {
      return value
    }
  }

  if (!hasWater) return 'no_water'
  if (flowRateLMin > 0.2) return 'active'
  return 'idle'
}

function batteryVoltageToPercent(voltage: number): number {
  if (!Number.isFinite(voltage) || voltage <= 0) return 0

  const BATTERY_EMPTY_V = 5.5
  const BATTERY_FULL_V = 8.4
  const percent = ((voltage - BATTERY_EMPTY_V) / (BATTERY_FULL_V - BATTERY_EMPTY_V)) * 100

  return clamp(percent, 0, 100)
}

function computeScreening(ph: number, turbidityPercent: number, lux: number, hasWater: boolean, sensorsForcedOff: boolean): {
  screeningScore: number
  screeningStatus: ScreeningStatus
  screeningSummary: string
} {
  if (sensorsForcedOff) {
    return {
      screeningScore: 0,
      screeningStatus: 'low',
      screeningSummary: 'Sensors are in maintenance mode. Manual intervention required to resume monitoring.',
    }
  }

  if (!hasWater) {
    return {
      screeningScore: 0,
      screeningStatus: 'low',
      screeningSummary: 'No water detected. Water quality screening is paused until the tank has water.',
    }
  }

  let score = 0
  const notes: string[] = []

  if (ph < 5.5 || ph > 9.5) {
    score += 55
    notes.push('strong pH deviation')
  } else if (ph < 6.5 || ph > 8.5) {
    score += 25
    notes.push('pH outside potable screening band')
  }

  if (turbidityPercent < 35) {
    score += 35
    notes.push('very high turbidity')
  } else if (turbidityPercent < 60) {
    score += 20
    notes.push('elevated turbidity')
  }

  if (lux < 40) {
    score += 10
    notes.push('low optical brightness')
  }

  score = Math.round(clamp(score, 0, 100))

  let screeningStatus: ScreeningStatus = 'low'
  if (score >= 60) screeningStatus = 'high'
  else if (score >= 25) screeningStatus = 'moderate'

  const screeningSummary = notes.length > 0
    ? `Screening only: ${notes.join('; ')}. Lab confirmation is still required for actual drug or chemical residue identification.`
    : 'Screening only: current sensors look stable, but they still cannot identify specific drug residues without lab confirmation.'

  return { screeningScore: score, screeningStatus, screeningSummary }
}

export function normalizeTelemetry(payload: Record<string, unknown>): TelemetryRecord {
  const tankCapacity = clamp(toFiniteNumber(payload.tankCapacity, 100), 1, 100000)
  const rawTankLevelPercent = clamp(toFiniteNumber(payload.tankLevelPercent, 0), 0, 100)
  const rawHasWater = typeof payload.hasWater === 'boolean'
    ? payload.hasWater
    : rawTankLevelPercent > 0.5

  const sensorsForcedOff = toBoolean(payload.sensorsForcedOff, false) // Only manual maintenance mode, never battery-forced
  const zeroSensors = !rawHasWater || rawTankLevelPercent <= 0.5 // Only zero sensors when no water, not due to battery

  const rawTimestamp = payload.timestamp
  const normalizedTimestamp = (() => {
    if (typeof rawTimestamp === 'number' && Number.isFinite(rawTimestamp)) {
      return new Date(rawTimestamp < 1e12 ? rawTimestamp * 1000 : rawTimestamp).toISOString()
    }

    if (typeof rawTimestamp === 'string' && rawTimestamp.trim()) {
      const trimmed = rawTimestamp.trim()
      if (/^\d+$/.test(trimmed)) {
        const numeric = Number(trimmed)
        return new Date(numeric < 1e12 ? numeric * 1000 : numeric).toISOString()
      }
      const parsed = new Date(trimmed)
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString()
      }
    }

    return new Date().toISOString()
  })()

  const hasWater = !zeroSensors
  const temperatureC = zeroSensors ? 0 : clamp(toFiniteNumber(payload.temperatureC, 0), 0, 125)
  const ph = zeroSensors ? 0 : clamp(toFiniteNumber(payload.ph, 0), 0, 14)
  const turbidityPercent = zeroSensors ? 0 : clamp(toFiniteNumber(payload.turbidityPercent, 0), 0, 100)
  const flowRateLMin = zeroSensors ? 0 : clamp(toFiniteNumber(payload.flowRateLMin, 0), 0, 200)
  const lux = zeroSensors ? 0 : clamp(toFiniteNumber(payload.lux, 0), 0, 200000)
  const phVoltage = zeroSensors ? 0 : clamp(toFiniteNumber(payload.phVoltage, 0), 0, 3.3)
  const turbidityVoltage = zeroSensors ? 0 : clamp(toFiniteNumber(payload.turbidityVoltage, 0), 0, 3.3)
  const batteryVoltage = clamp(toFiniteNumber(payload.batteryVoltage, 0), 0, 25)
  const batteryLevel = batteryVoltageToPercent(batteryVoltage)
  const screening = computeScreening(ph, turbidityPercent, lux, hasWater, sensorsForcedOff)

  return {
    recordId: String(payload.recordId ?? `${String(payload.deviceId ?? '')}:${normalizedTimestamp}`),
    deviceId: String(payload.deviceId ?? ''),
    timestamp: normalizedTimestamp,
    receivedAt: Date.now(),
    hasWater,
    temperatureC,
    ph,
    turbidityPercent,
    flowRateLMin,
    tankLevelPercent: zeroSensors ? 0 : rawTankLevelPercent,
    tankCapacity,
    colorR: zeroSensors ? 0 : sanitizeInt(payload.colorR),
    colorG: zeroSensors ? 0 : sanitizeInt(payload.colorG),
    colorB: zeroSensors ? 0 : sanitizeInt(payload.colorB),
    lux,
    batteryLevel,
    batteryVoltage,
    isCharging: toBoolean(payload.isCharging),
    pulseCount: zeroSensors ? 0 : Math.max(0, Math.round(toFiniteNumber(payload.pulseCount, 0))),
    sdCardActive: toBoolean(payload.sdCardActive),
    sdCardWriting: toBoolean(payload.sdCardWriting),
    sdCardUsage: clamp(toFiniteNumber(payload.sdCardUsage, 0), 0, 100),
    uptimeSeconds: Math.max(0, Math.round(toFiniteNumber(payload.uptimeSeconds, 0))),
    temperatureSensorOk: hasWater ? toBoolean(payload.temperatureSensorOk, temperatureC > 0) : true,
    phSensorOk: hasWater ? toBoolean(payload.phSensorOk, phVoltage > 0.05) : true,
    turbiditySensorOk: hasWater ? toBoolean(payload.turbiditySensorOk, turbidityVoltage > 0.05) : true,
    ultrasonicSensorOk: toBoolean(payload.ultrasonicSensorOk, rawTankLevelPercent >= 0),
    colorSensorOk: hasWater ? toBoolean(payload.colorSensorOk, (sanitizeInt(payload.colorR) + sanitizeInt(payload.colorG) + sanitizeInt(payload.colorB)) > 0) : true,
    flowSensorState: toFlowSensorState(payload.flowSensorState, hasWater, flowRateLMin),
    sensorsForcedOff,
    phVoltage,
    turbidityVoltage,
    screeningScore: clamp(toFiniteNumber(payload.screeningScore, screening.screeningScore), 0, 100),
    screeningStatus: typeof payload.screeningStatus === 'string' && ['low', 'moderate', 'high'].includes(payload.screeningStatus)
      ? payload.screeningStatus as ScreeningStatus
      : screening.screeningStatus,
    screeningSummary: String(payload.screeningSummary ?? screening.screeningSummary),
  }
}

export function saveTelemetry(record: TelemetryRecord) {
  const store = getTelemetryStore()
  const identity = getRecordIdentity(record)

  if (store.ids.has(identity)) {
    store.latest = record
    persistLatest(record)
    return false
  }

  store.ids.add(identity)
  store.latest = record
  store.records = [...store.records.slice(-(MAX_RECORDS - 1)), record]

  appendHistoryRecord(record)
  persistLatest(record)

  if (store.records.length >= MAX_RECORDS || store.records.length % 250 === 0) {
    compactHistoryFile(store.records)
    store.ids = new Set(store.records.map((item) => getRecordIdentity(item)))
  }

  return true
}

export function getTelemetryHistory(limit = MAX_RECORDS) {
  const store = getTelemetryStore()
  return store.records.slice(-limit)
}

export function getLatestReading(): TelemetryRecord | null {
  const store = getTelemetryStore()
  return store.latest
}

export function getDashboardPayload() {
  const store = getTelemetryStore()
  const latest = store.latest
  const staleAfterMs = 15000

  if (!latest || Date.now() - latest.receivedAt > staleAfterMs) {
    return {
      connected: false,
      staleAfterMs,
      reading: {
        recordId: latest?.recordId ?? 'offline',
        deviceId: latest?.deviceId ?? 'ESP32-WATER-01',
        timestamp: latest?.timestamp ?? null,
        receivedAt: latest?.receivedAt ?? null,
        hasWater: false,
        temperatureC: 0,
        ph: 0,
        turbidityPercent: 0,
        flowRateLMin: 0,
        tankLevelPercent: 0,
        tankCapacity: latest?.tankCapacity ?? 100,
        colorR: 0,
        colorG: 0,
        colorB: 0,
        lux: 0,
        batteryLevel: 0,
        batteryVoltage: 0,
        isCharging: false,
        pulseCount: 0,
        sdCardActive: latest?.sdCardActive ?? false,
        sdCardWriting: false,
        sdCardUsage: latest?.sdCardUsage ?? 0,
        uptimeSeconds: latest?.uptimeSeconds ?? 0,
        temperatureSensorOk: latest?.temperatureSensorOk ?? false,
        phSensorOk: latest?.phSensorOk ?? false,
        turbiditySensorOk: latest?.turbiditySensorOk ?? false,
        ultrasonicSensorOk: latest?.ultrasonicSensorOk ?? false,
        colorSensorOk: latest?.colorSensorOk ?? false,
        flowSensorState: latest?.flowSensorState ?? 'unknown',
        sensorsForcedOff: false,
        phVoltage: 0,
        turbidityVoltage: 0,
        screeningScore: 0,
        screeningStatus: 'low',
        screeningSummary: 'Waiting for telemetry from the ESP32.',
      },
    }
  }

  return {
    connected: true,
    staleAfterMs,
    reading: latest,
  }
}
