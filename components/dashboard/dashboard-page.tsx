"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { TankLevel } from "@/components/dashboard/tank-level"
import { PhGauge } from "@/components/dashboard/ph-gauge"
import { SystemStatus } from "@/components/dashboard/system-status"
import { SensorChart } from "@/components/dashboard/sensor-chart"
import { HistoryChart } from "@/components/dashboard/history-chart"
import { MultiMetricChart } from "@/components/dashboard/multi-metric-chart"
import { PinConfiguration } from "@/components/dashboard/pin-configuration"
import { ChemicalRegistry } from "@/components/dashboard/chemical-registry"
import { AlertPanel, type Alert } from "@/components/dashboard/alert-panel"
import { CalibrationPanel } from "@/components/dashboard/calibration-panel"
import { ThermometerGauge } from "@/components/dashboard/thermometer-gauge"
import { TurbidityGauge } from "@/components/dashboard/turbidity-gauge"
import { FlowGauge } from "@/components/dashboard/flow-gauge"
import { ColorSensorGauge } from "@/components/dashboard/color-sensor-gauge"
import { ColorChannelChart } from "@/components/dashboard/color-channel-chart"
import { ColorDailyChart } from "@/components/dashboard/color-daily-chart"
import { SensorRecognitionPanel } from "@/components/dashboard/sensor-recognition-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type TelemetryReading = {
  recordId: string
  deviceId: string
  timestamp: string | null
  receivedAt: number | null
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
  flowSensorState: "active" | "idle" | "no_water" | "unknown"
  sensorsForcedOff: boolean
  phVoltage: number
  turbidityVoltage: number
  screeningScore: number
  screeningStatus: "low" | "moderate" | "high"
  screeningSummary: string
}

type LatestResponse = {
  connected: boolean
  staleAfterMs: number
  reading: TelemetryReading
}

type HistoryResponse = {
  records: TelemetryReading[]
}

type DataPoint = { time: string; value: number; ts: number; count: number }
type ComparisonPoint = {
  time: string
  ph: number
  temperatureC: number
  turbidityPercent: number
  flowRateLMin: number
  phNormalized: number
  temperatureNormalized: number
  turbidityNormalized: number
  flowNormalized: number
}
type DailyPoint = {
  date: string
  min: number
  max: number
  avg: number
  total: number
  count: number
}

const LIVE_BUCKET_MS = 5 * 60 * 1000
const LIVE_WINDOW_MS = 24 * 60 * 60 * 1000

const EMPTY_READING: TelemetryReading = {
  recordId: "offline",
  deviceId: "ESP32-WATER-01",
  timestamp: null,
  receivedAt: null,
  hasWater: false,
  temperatureC: 0,
  ph: 0,
  turbidityPercent: 0,
  flowRateLMin: 0,
  tankLevelPercent: 0,
  tankCapacity: 100,
  colorR: 0,
  colorG: 0,
  colorB: 0,
  lux: 0,
  pulseCount: 0,
  sdCardActive: false,
  sdCardWriting: false,
  sdCardUsage: 0,
  uptimeSeconds: 0,
  temperatureSensorOk: false,
  phSensorOk: false,
  turbiditySensorOk: false,
  ultrasonicSensorOk: false,
  colorSensorOk: false,
  flowSensorState: "unknown",
  sensorsForcedOff: false,
  phVoltage: 0,
  turbidityVoltage: 0,
  screeningScore: 0,
  screeningStatus: "low",
  screeningSummary: "Waiting for telemetry from the ESP32.",
}

function formatClock(value: string | null) {
  const date = parseReadingDate(value)
  if (!date) return null
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

function parseReadingDate(value: string | null) {
  if (!value) return null
  if (/^\d+$/.test(value)) {
    const numeric = Number(value)
    const date = new Date(numeric < 1e12 ? numeric * 1000 : numeric)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getPhClassification(ph: number): { classification: string; substance: string } {
  if (ph === 0) return { classification: "No Water", substance: "Screening paused" }
  if (ph < 2.5) return { classification: "Strongly Acidic", substance: "Potential corrosive event" }
  if (ph < 6.5) return { classification: "Acidic", substance: "Possible chemistry imbalance" }
  if (ph < 8.5) return { classification: "Screening Band", substance: "Typical potable range" }
  if (ph < 11.5) return { classification: "Alkaline", substance: "Possible detergent / base event" }
  return { classification: "Strongly Basic", substance: "Potential caustic event" }
}

function getTankStatus(levelPercent: number): "full" | "normal" | "low" | "empty" {
  if (levelPercent >= 90) return "full"
  if (levelPercent >= 30) return "normal"
  if (levelPercent > 5) return "low"
  return "empty"
}

function generateAlerts(sensorData: TelemetryReading, connected: boolean): Alert[] {
  const alerts: Alert[] = []
  const alertTimestamp = parseReadingDate(sensorData.timestamp) ?? new Date(0)

  if (!connected) {
    alerts.push({
      id: "esp32-offline",
      severity: "critical",
      title: "ESP32 Offline",
      message: "No live telemetry is being received. Historical data is still available from stored records.",
      timestamp: alertTimestamp,
      source: "Dashboard API",
    })
    return alerts
  }

  if (!sensorData.hasWater || sensorData.tankLevelPercent <= 0) {
    alerts.push({
      id: "tank-empty",
      severity: "warning",
      title: "No Water In Tank",
      message: "Tank level is zero, so water-quality screening and turbidity reporting are intentionally held at zero.",
      timestamp: alertTimestamp,
      source: "Ultrasonic Sensor",
    })
    return alerts
  }

  if (!sensorData.temperatureSensorOk || !sensorData.phSensorOk || !sensorData.turbiditySensorOk || !sensorData.ultrasonicSensorOk || !sensorData.colorSensorOk || sensorData.flowSensorState === "unknown") {
    alerts.push({
      id: "sensor-check",
      severity: "warning",
      title: "Sensor Recognition Check",
      message: "One or more sensors are not reporting healthy signals. Review the Sensor Recognition panel and wiring.",
      timestamp: alertTimestamp,
      source: "Sensor Diagnostics",
    })
  }

  if (sensorData.ph < 4 || sensorData.ph > 10) {
    alerts.push({
      id: "ph-extreme",
      severity: "critical",
      title: "Extreme pH Detected",
      message: `pH level at ${sensorData.ph.toFixed(2)} - potential hazardous chemistry event detected.`,
      timestamp: alertTimestamp,
      source: "pH Sensor",
    })
  } else if (sensorData.ph < 6.5 || sensorData.ph > 8.5) {
    alerts.push({
      id: "ph-warning",
      severity: "warning",
      title: "pH Outside Screening Band",
      message: `pH level at ${sensorData.ph.toFixed(2)} - outside the potable screening range (6.5-8.5).`,
      timestamp: alertTimestamp,
      source: "pH Sensor",
    })
  }

  if (sensorData.temperatureC > 35) {
    alerts.push({
      id: "temp-high",
      severity: "warning",
      title: "High Temperature",
      message: `Water temperature at ${sensorData.temperatureC.toFixed(1)}°C - above recommended range.`,
      timestamp: alertTimestamp,
      source: "Temperature Sensor",
    })
  }

  if (sensorData.turbidityPercent < 35 && sensorData.hasWater) {
    alerts.push({
      id: "turbidity-critical",
      severity: "critical",
      title: "Very High Turbidity",
      message: `Turbidity at ${sensorData.turbidityPercent.toFixed(0)}% - strong screening anomaly detected.`,
      timestamp: alertTimestamp,
      source: "Turbidity Sensor",
    })
  } else if (sensorData.turbidityPercent < 60 && sensorData.hasWater) {
    alerts.push({
      id: "turbidity-poor",
      severity: "warning",
      title: "Elevated Turbidity",
      message: `Turbidity at ${sensorData.turbidityPercent.toFixed(0)}% - investigate possible suspended solids or contamination.`,
      timestamp: alertTimestamp,
      source: "Turbidity Sensor",
    })
  }

  if (sensorData.screeningStatus === "high") {
    alerts.push({
      id: "screening-high",
      severity: "critical",
      title: "High Residue Screening Score",
      message: sensorData.screeningSummary,
      timestamp: alertTimestamp,
      source: "Screening Engine",
    })
  } else if (sensorData.screeningStatus === "moderate") {
    alerts.push({
      id: "screening-moderate",
      severity: "warning",
      title: "Moderate Residue Screening Score",
      message: sensorData.screeningSummary,
      timestamp: alertTimestamp,
      source: "Screening Engine",
    })
  }

  return alerts
}

function toTimestampMs(value: string | null) {
  const date = parseReadingDate(value)
  return date ? date.getTime() : Date.now()
}

function formatBucketLabel(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function appendPoint(prev: DataPoint[], isoTimestamp: string | null, value: number) {
  const ts = toTimestampMs(isoTimestamp)
  const bucketTs = Math.floor(ts / LIVE_BUCKET_MS) * LIVE_BUCKET_MS

  if (prev.length > 0 && prev[prev.length - 1].ts === bucketTs) {
    const last = prev[prev.length - 1]
    const count = last.count + 1
    const next = [...prev]

    next[next.length - 1] = {
      ts: bucketTs,
      time: formatBucketLabel(bucketTs),
      count,
      value: Number((((last.value * last.count) + value) / count).toFixed(2)),
    }

    return next.filter((point) => point.ts >= bucketTs - LIVE_WINDOW_MS)
  }

  return [...prev, {
    ts: bucketTs,
    time: formatBucketLabel(bucketTs),
    value,
    count: 1,
  }].filter((point) => point.ts >= bucketTs - LIVE_WINDOW_MS)
}

function updateDailyHistory(prev: DailyPoint[], isoTimestamp: string | null, value: number): DailyPoint[] {
  if (!isoTimestamp) return prev
  const date = parseReadingDate(isoTimestamp)
  if (!date) return prev

  const key = date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  const existing = prev.find((item) => item.date === key)

  if (!existing) {
    return [...prev, {
      date: key,
      min: value,
      max: value,
      avg: value,
      total: value,
      count: 1,
    }].slice(-7)
  }

  return prev.map((item) => {
    if (item.date !== key) return item

    const total = item.total + value
    const count = item.count + 1

    return {
      ...item,
      min: Math.min(item.min, value),
      max: Math.max(item.max, value),
      total,
      count,
      avg: Number((total / count).toFixed(2)),
    }
  }).slice(-7)
}

function buildLiveSeries(records: TelemetryReading[], pick: (r: TelemetryReading) => number): DataPoint[] {
  const cutoff = Date.now() - LIVE_WINDOW_MS
  const buckets = new Map<number, { sum: number; count: number }>()

  for (const record of records) {
    const ts = toTimestampMs(record.timestamp)
    if (ts < cutoff) continue

    const bucketTs = Math.floor(ts / LIVE_BUCKET_MS) * LIVE_BUCKET_MS
    const current = buckets.get(bucketTs) ?? { sum: 0, count: 0 }
    current.sum += pick(record)
    current.count += 1
    buckets.set(bucketTs, current)
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ts, bucket]) => ({
      ts,
      time: formatBucketLabel(ts),
      count: bucket.count,
      value: Number((bucket.sum / bucket.count).toFixed(2)),
    }))
}

function normalize(value: number, min: number, max: number) {
  if (max <= min) return 50
  return Number((((value - min) / (max - min)) * 100).toFixed(2))
}

function buildComparisonSeries(records: TelemetryReading[]): ComparisonPoint[] {
  const cutoff = Date.now() - LIVE_WINDOW_MS
  const buckets = new Map<number, {
    phSum: number
    tempSum: number
    turbiditySum: number
    flowSum: number
    count: number
  }>()

  for (const record of records) {
    const ts = toTimestampMs(record.timestamp)
    if (ts < cutoff) continue

    const bucketTs = Math.floor(ts / LIVE_BUCKET_MS) * LIVE_BUCKET_MS
    const current = buckets.get(bucketTs) ?? { phSum: 0, tempSum: 0, turbiditySum: 0, flowSum: 0, count: 0 }
    current.phSum += record.ph
    current.tempSum += record.temperatureC
    current.turbiditySum += record.turbidityPercent
    current.flowSum += record.flowRateLMin
    current.count += 1
    buckets.set(bucketTs, current)
  }

  const rawSeries = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ts, bucket]) => ({
      ts,
      time: formatBucketLabel(ts),
      ph: Number((bucket.phSum / bucket.count).toFixed(2)),
      temperatureC: Number((bucket.tempSum / bucket.count).toFixed(2)),
      turbidityPercent: Number((bucket.turbiditySum / bucket.count).toFixed(2)),
      flowRateLMin: Number((bucket.flowSum / bucket.count).toFixed(2)),
    }))

  if (rawSeries.length === 0) return []

  const phMin = Math.min(...rawSeries.map((item) => item.ph))
  const phMax = Math.max(...rawSeries.map((item) => item.ph))
  const tempMin = Math.min(...rawSeries.map((item) => item.temperatureC))
  const tempMax = Math.max(...rawSeries.map((item) => item.temperatureC))
  const turbidityMin = Math.min(...rawSeries.map((item) => item.turbidityPercent))
  const turbidityMax = Math.max(...rawSeries.map((item) => item.turbidityPercent))
  const flowMin = Math.min(...rawSeries.map((item) => item.flowRateLMin))
  const flowMax = Math.max(...rawSeries.map((item) => item.flowRateLMin))

  return rawSeries.map((item) => ({
    time: item.time,
    ph: item.ph,
    temperatureC: item.temperatureC,
    turbidityPercent: item.turbidityPercent,
    flowRateLMin: item.flowRateLMin,
    phNormalized: normalize(item.ph, phMin, phMax),
    temperatureNormalized: normalize(item.temperatureC, tempMin, tempMax),
    turbidityNormalized: normalize(item.turbidityPercent, turbidityMin, turbidityMax),
    flowNormalized: normalize(item.flowRateLMin, flowMin, flowMax),
  }))
}

function appendComparisonPoint(prev: ComparisonPoint[], reading: TelemetryReading): ComparisonPoint[] {
  const nextRaw = [...prev.map((item) => ({
    time: item.time,
    ph: item.ph,
    temperatureC: item.temperatureC,
    turbidityPercent: item.turbidityPercent,
    flowRateLMin: item.flowRateLMin,
  })), {
    time: formatBucketLabel(toTimestampMs(reading.timestamp)),
    ph: reading.ph,
    temperatureC: reading.temperatureC,
    turbidityPercent: reading.turbidityPercent,
    flowRateLMin: reading.flowRateLMin,
  }]

  const deduped = new Map<string, { time: string; ph: number; temperatureC: number; turbidityPercent: number; flowRateLMin: number; count: number }>()

  for (const item of nextRaw) {
    const current = deduped.get(item.time)
    if (!current) {
      deduped.set(item.time, { ...item, count: 1 })
      continue
    }

    const count = current.count + 1
    deduped.set(item.time, {
      time: item.time,
      ph: Number((((current.ph * current.count) + item.ph) / count).toFixed(2)),
      temperatureC: Number((((current.temperatureC * current.count) + item.temperatureC) / count).toFixed(2)),
      turbidityPercent: Number((((current.turbidityPercent * current.count) + item.turbidityPercent) / count).toFixed(2)),
      flowRateLMin: Number((((current.flowRateLMin * current.count) + item.flowRateLMin) / count).toFixed(2)),
      count,
    })
  }

  const rows = [...deduped.values()].slice(-Math.ceil(LIVE_WINDOW_MS / LIVE_BUCKET_MS))
  if (rows.length === 0) return []

  const phMin = Math.min(...rows.map((item) => item.ph))
  const phMax = Math.max(...rows.map((item) => item.ph))
  const tempMin = Math.min(...rows.map((item) => item.temperatureC))
  const tempMax = Math.max(...rows.map((item) => item.temperatureC))
  const turbidityMin = Math.min(...rows.map((item) => item.turbidityPercent))
  const turbidityMax = Math.max(...rows.map((item) => item.turbidityPercent))
  const flowMin = Math.min(...rows.map((item) => item.flowRateLMin))
  const flowMax = Math.max(...rows.map((item) => item.flowRateLMin))

  return rows.map((item) => ({
    time: item.time,
    ph: item.ph,
    temperatureC: item.temperatureC,
    turbidityPercent: item.turbidityPercent,
    flowRateLMin: item.flowRateLMin,
    phNormalized: normalize(item.ph, phMin, phMax),
    temperatureNormalized: normalize(item.temperatureC, tempMin, tempMax),
    turbidityNormalized: normalize(item.turbidityPercent, turbidityMin, turbidityMax),
    flowNormalized: normalize(item.flowRateLMin, flowMin, flowMax),
  }))
}

function buildDailySeries(records: TelemetryReading[], pick: (r: TelemetryReading) => number): DailyPoint[] {
  const daily = new Map<string, { date: string; min: number; max: number; total: number; count: number; ts: number }>()

  for (const record of records) {
    const date = parseReadingDate(record.timestamp)
    if (!date) continue

    const value = pick(record)
    const key = date.toISOString().slice(0, 10)
    const existing = daily.get(key)

    if (!existing) {
      daily.set(key, {
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        min: value,
        max: value,
        total: value,
        count: 1,
        ts: date.getTime(),
      })
      continue
    }

    existing.min = Math.min(existing.min, value)
    existing.max = Math.max(existing.max, value)
    existing.total += value
    existing.count += 1
    existing.ts = Math.max(existing.ts, date.getTime())
  }

  return [...daily.values()]
    .sort((a, b) => a.ts - b.ts)
    .slice(-7)
    .map((item) => ({
      date: item.date,
      min: item.min,
      max: item.max,
      total: item.total,
      count: item.count,
      avg: Number((item.total / item.count).toFixed(2)),
    }))
}

function formatUptime(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${days}d ${hours}h ${minutes}m`
}

export function DashboardPage() {
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [reading, setReading] = useState<TelemetryReading>(EMPTY_READING)
  const [phHistory, setPhHistory] = useState<DataPoint[]>([])
  const [tempHistory, setTempHistory] = useState<DataPoint[]>([])
  const [turbidityHistory, setTurbidityHistory] = useState<DataPoint[]>([])
  const [flowHistory, setFlowHistory] = useState<DataPoint[]>([])
  const [comparisonHistory, setComparisonHistory] = useState<ComparisonPoint[]>([])
  const [phDailyHistory, setPhDailyHistory] = useState<DailyPoint[]>([])
  const [tempDailyHistory, setTempDailyHistory] = useState<DailyPoint[]>([])
  const [turbidityDailyHistory, setTurbidityDailyHistory] = useState<DailyPoint[]>([])
  const [flowDailyHistory, setFlowDailyHistory] = useState<DailyPoint[]>([])
  const [colorRHistory, setColorRHistory] = useState<DataPoint[]>([])
  const [colorGHistory, setColorGHistory] = useState<DataPoint[]>([])
  const [colorBHistory, setColorBHistory] = useState<DataPoint[]>([])
  const [colorRDailyHistory, setColorRDailyHistory] = useState<DailyPoint[]>([])
  const [colorGDailyHistory, setColorGDailyHistory] = useState<DailyPoint[]>([])
  const [colorBDailyHistory, setColorBDailyHistory] = useState<DailyPoint[]>([])
  const lastAppliedRecordIdRef = useRef<string | null>(null)
  const wasConnectedRef = useRef(false)
  const sdCardUsageRef = useRef<HTMLDivElement | null>(null)

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/history", { cache: "no-store" })
      if (!response.ok) return

      const payload = (await response.json()) as HistoryResponse

      setPhHistory(buildLiveSeries(payload.records, (r) => r.ph))
      setTempHistory(buildLiveSeries(payload.records, (r) => r.temperatureC))
      setTurbidityHistory(buildLiveSeries(payload.records, (r) => r.turbidityPercent))
      setFlowHistory(buildLiveSeries(payload.records, (r) => r.flowRateLMin))
      setColorRHistory(buildLiveSeries(payload.records, (r) => r.colorR))
      setColorGHistory(buildLiveSeries(payload.records, (r) => r.colorG))
      setColorBHistory(buildLiveSeries(payload.records, (r) => r.colorB))
      setComparisonHistory(buildComparisonSeries(payload.records))

      setPhDailyHistory(buildDailySeries(payload.records, (r) => r.ph))
      setTempDailyHistory(buildDailySeries(payload.records, (r) => r.temperatureC))
      setTurbidityDailyHistory(buildDailySeries(payload.records, (r) => r.turbidityPercent))
      setFlowDailyHistory(buildDailySeries(payload.records, (r) => r.flowRateLMin))
      setColorRDailyHistory(buildDailySeries(payload.records, (r) => r.colorR))
      setColorGDailyHistory(buildDailySeries(payload.records, (r) => r.colorG))
      setColorBDailyHistory(buildDailySeries(payload.records, (r) => r.colorB))

      const lastRecord = payload.records[payload.records.length - 1]
      lastAppliedRecordIdRef.current = lastRecord?.recordId ?? null
    } catch {
      // ignore
    }
  }, [])

  const applyLatest = useCallback((payload: LatestResponse) => {
    const nextReading = payload.connected
      ? payload.reading
      : {
          ...payload.reading,
          ...EMPTY_READING,
          deviceId: payload.reading.deviceId || EMPTY_READING.deviceId,
          tankCapacity: payload.reading.tankCapacity || 100,
          sdCardActive: payload.reading.sdCardActive,
          sdCardUsage: payload.reading.sdCardUsage,
          uptimeSeconds: payload.reading.uptimeSeconds,
          temperatureSensorOk: payload.reading.temperatureSensorOk,
          phSensorOk: payload.reading.phSensorOk,
          turbiditySensorOk: payload.reading.turbiditySensorOk,
          ultrasonicSensorOk: payload.reading.ultrasonicSensorOk,
          colorSensorOk: payload.reading.colorSensorOk,
          flowSensorState: payload.reading.flowSensorState,
          sensorsForcedOff: payload.reading.sensorsForcedOff,
          screeningScore: payload.reading.screeningScore,
          screeningStatus: payload.reading.screeningStatus,
          screeningSummary: payload.reading.screeningSummary,
        }

    setIsConnected(payload.connected)
    setReading(nextReading)
    setLastUpdate(formatClock(nextReading.timestamp))

    if (payload.connected && !wasConnectedRef.current) {
      void loadHistory()
    }
    wasConnectedRef.current = payload.connected

    if (!payload.connected || !nextReading.timestamp) {
      return
    }

    if (nextReading.recordId === lastAppliedRecordIdRef.current) {
      return
    }

    lastAppliedRecordIdRef.current = nextReading.recordId

    setPhHistory((prev) => appendPoint(prev, nextReading.timestamp, nextReading.ph))
    setTempHistory((prev) => appendPoint(prev, nextReading.timestamp, nextReading.temperatureC))
    setTurbidityHistory((prev) => appendPoint(prev, nextReading.timestamp, nextReading.turbidityPercent))
    setFlowHistory((prev) => appendPoint(prev, nextReading.timestamp, nextReading.flowRateLMin))
    setColorRHistory((prev) => appendPoint(prev, nextReading.timestamp, nextReading.colorR))
    setColorGHistory((prev) => appendPoint(prev, nextReading.timestamp, nextReading.colorG))
    setColorBHistory((prev) => appendPoint(prev, nextReading.timestamp, nextReading.colorB))
    setComparisonHistory((prev) => appendComparisonPoint(prev, nextReading))

    setPhDailyHistory((prev) => updateDailyHistory(prev, nextReading.timestamp, nextReading.ph))
    setTempDailyHistory((prev) => updateDailyHistory(prev, nextReading.timestamp, nextReading.temperatureC))
    setTurbidityDailyHistory((prev) => updateDailyHistory(prev, nextReading.timestamp, nextReading.turbidityPercent))
    setFlowDailyHistory((prev) => updateDailyHistory(prev, nextReading.timestamp, nextReading.flowRateLMin))
    setColorRDailyHistory((prev) => updateDailyHistory(prev, nextReading.timestamp, nextReading.colorR))
    setColorGDailyHistory((prev) => updateDailyHistory(prev, nextReading.timestamp, nextReading.colorG))
    setColorBDailyHistory((prev) => updateDailyHistory(prev, nextReading.timestamp, nextReading.colorB))
  }, [loadHistory])

  const fetchLatest = useCallback(async () => {
    try {
      const response = await fetch("/api/latest", { cache: "no-store" })
      if (!response.ok) {
        throw new Error(`Latest API returned ${response.status}`)
      }
      const payload = (await response.json()) as LatestResponse
      applyLatest(payload)
    } catch {
      applyLatest({ connected: false, staleAfterMs: 15000, reading: EMPTY_READING })
    }
  }, [applyLatest])

  useEffect(() => {
    void loadHistory()
    void fetchLatest()
    const interval = window.setInterval(() => {
      void fetchLatest()
    }, 2000)  // Poll every 2 seconds for stable real-time updates
    return () => window.clearInterval(interval)
  }, [fetchLatest, loadHistory])

  useEffect(() => {
    const handleReconnect = () => {
      void loadHistory()
      void fetchLatest()
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        handleReconnect()
      }
    }

    window.addEventListener("online", handleReconnect)
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      window.removeEventListener("online", handleReconnect)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [fetchLatest, loadHistory])

  useEffect(() => {
    if (!sdCardUsageRef.current) return
    sdCardUsageRef.current.style.setProperty("--sd-card-usage", `${reading.sdCardUsage}%`)
  }, [reading.sdCardUsage])

  const phClassification = useMemo(() => getPhClassification(reading.ph), [reading.ph])
  const tankStatus = useMemo(() => getTankStatus(reading.tankLevelPercent), [reading.tankLevelPercent])

  // Build color channel chart data by merging R, G, B history
  const colorChannelData = useMemo(() => {
    // Merge all three channels by time
    const allTimes = new Set([
      ...colorRHistory.map((d) => d.time),
      ...colorGHistory.map((d) => d.time),
      ...colorBHistory.map((d) => d.time),
    ])
    const sortedTimes = Array.from(allTimes).sort()

    // Create lookup maps
    const rMap = new Map(colorRHistory.map((d) => [d.time, d.value]))
    const gMap = new Map(colorGHistory.map((d) => [d.time, d.value]))
    const bMap = new Map(colorBHistory.map((d) => [d.time, d.value]))

    return sortedTimes.map((time) => ({
      time,
      r: rMap.get(time) ?? 0,
      g: gMap.get(time) ?? 0,
      b: bMap.get(time) ?? 0,
    }))
  }, [colorRHistory, colorGHistory, colorBHistory])

  // Build color daily chart data by merging R, G, B daily history
  const colorDailyData = useMemo(() => {
    const allDates = new Set([
      ...colorRDailyHistory.map((d) => d.date),
      ...colorGDailyHistory.map((d) => d.date),
      ...colorBDailyHistory.map((d) => d.date),
    ])
    const sortedDates = Array.from(allDates).sort()

    const rMap = new Map(colorRDailyHistory.map((d) => [d.date, d]))
    const gMap = new Map(colorGDailyHistory.map((d) => [d.date, d]))
    const bMap = new Map(colorBDailyHistory.map((d) => [d.date, d]))

    return sortedDates.map((date) => {
      const r = rMap.get(date)
      const g = gMap.get(date)
      const b = bMap.get(date)
      return {
        date,
        rMin: r?.min ?? 0,
        rMax: r?.max ?? 0,
        rAvg: r?.avg ?? 0,
        gMin: g?.min ?? 0,
        gMax: g?.max ?? 0,
        gAvg: g?.avg ?? 0,
        bMin: b?.min ?? 0,
        bMax: b?.max ?? 0,
        bAvg: b?.avg ?? 0,
      }
    })
  }, [colorRDailyHistory, colorGDailyHistory, colorBDailyHistory])
  const systemMode = !isConnected
    ? "error"
    : tankStatus === "empty"
      ? "error"
      : reading.flowRateLMin > 0.5
        ? "active"
        : "static"

  const activeAlerts = useMemo(() => generateAlerts(reading, isConnected), [reading, isConnected])

  return (
    <div className="min-h-screen bg-background">
        <DashboardHeader
          isConnected={isConnected}
          lastUpdate={lastUpdate}
          onRefresh={() => void fetchLatest()}
        />

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <AlertPanel alerts={activeAlerts} />

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <ThermometerGauge value={reading.temperatureC} min={0} max={50} warningLow={15} warningHigh={30} />
              <TurbidityGauge value={reading.turbidityPercent} hasWater={reading.hasWater} isConnected={isConnected} />
              <PhGauge value={reading.ph} classification={phClassification.classification} substance={phClassification.substance} />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <FlowGauge
                flowRate={reading.flowRateLMin}
                maxFlow={10}
                pulseCount={reading.pulseCount}
                isActive={reading.flowRateLMin > 0.5}
              />
              <ColorSensorGauge
                r={reading.colorR}
                g={reading.colorG}
                b={reading.colorB}
                clearValue={Math.floor((reading.colorR + reading.colorG + reading.colorB) / 3)}
                lux={reading.lux}
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <TankLevel level={reading.tankLevelPercent} capacity={reading.tankCapacity} status={tankStatus} />
              <ChemicalRegistry
                currentPh={reading.ph}
                turbidityPercent={reading.turbidityPercent}
                lux={reading.lux}
                isConnected={isConnected}
                hasWater={reading.hasWater}
                screeningScore={reading.screeningScore}
                screeningStatus={reading.screeningStatus}
                screeningSummary={reading.screeningSummary}
              />
              <SensorRecognitionPanel
                hasWater={reading.hasWater}
                phVoltage={reading.phVoltage}
                turbidityVoltage={reading.turbidityVoltage}
                temperatureSensorOk={reading.temperatureSensorOk}
                phSensorOk={reading.phSensorOk}
                turbiditySensorOk={reading.turbiditySensorOk}
                ultrasonicSensorOk={reading.ultrasonicSensorOk}
                colorSensorOk={reading.colorSensorOk}
                flowSensorState={reading.flowSensorState}
                isConnected={isConnected}
              />
              <SystemStatus
                mode={systemMode}
                flowDetected={reading.flowRateLMin > 0.5}
                calibrationStatus={isConnected && reading.hasWater ? "complete" : "needed"}
                errors={
                  !isConnected
                    ? ["ESP32 OFFLINE - Waiting for live telemetry"]
                    : !reading.hasWater
                      ? ["TANK EMPTY - Water screening paused"]
                      : [
                          ...(!reading.temperatureSensorOk ? ["Temperature sensor not recognized"] : []),
                          ...(!reading.phSensorOk ? ["pH probe signal missing"] : []),
                          ...(!reading.turbiditySensorOk ? ["Turbidity sensor signal missing"] : []),
                          ...(!reading.ultrasonicSensorOk ? ["Ultrasonic level sensor echo missing"] : []),
                          ...(!reading.colorSensorOk ? ["Color sensor pulse output missing"] : []),
                          ...(reading.flowSensorState === "unknown" ? ["Flow sensor signal is unknown"] : []),
                        ]
                }
                uptime={formatUptime(reading.uptimeSeconds)}
                sdCardActive={reading.sdCardActive}
                sdCardWriting={reading.sdCardWriting}
                sdCardUsage={reading.sdCardUsage}
              />
            </div>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Real-time Sensor History</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className={`h-2 w-2 rounded-full ${isConnected ? "animate-pulse bg-primary" : "bg-destructive"}`} />
                <span className={isConnected ? "" : "font-semibold text-warning animate-pulse"}>
                  {isConnected ? "Last 24 hours • 5-minute buckets • real-time polling" : "Offline • Showing historical data"}
                </span>
              </div>
            </div>

            <MultiMetricChart data={comparisonHistory} />

            <div className="grid gap-6 lg:grid-cols-2">
              <SensorChart title="pH Level - 24h" data={phHistory} color="#22d3ee" unit="pH" minDomain={0} maxDomain={14} warningThresholds={{ low: 6.5, high: 8.5 }} />
              <SensorChart title="Temperature - 24h" data={tempHistory} color="#f97316" unit="°C" minDomain={0} maxDomain={50} warningThresholds={{ low: 15, high: 30 }} />
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <SensorChart title="Turbidity - 24h" data={turbidityHistory} color="#a78bfa" unit="%" minDomain={0} maxDomain={100} warningThresholds={{ low: 60 }} />
              <SensorChart title="Flow Rate - 24h" data={flowHistory} color="#34d399" unit="L/min" minDomain={0} maxDomain={10} warningThresholds={{ low: 0.5 }} />
              <ColorChannelChart title="Color Sensor RGB - 24h" data={colorChannelData} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Advanced Historical Analysis</h2>
                <p className="text-sm text-muted-foreground">Zoomable charts, average lines, range bars, cross-sensor comparison, and stored telemetry.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Built from stored ESP32 readings</span>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <HistoryChart title="pH Level - Daily Range" data={phDailyHistory} color="#22d3ee" unit="" normalRange={{ low: 6.5, high: 8.5 }} />
              <HistoryChart title="Temperature - Daily Range" data={tempDailyHistory} color="#f97316" unit="°C" normalRange={{ low: 15, high: 30 }} />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <HistoryChart title="Turbidity - Daily Range" data={turbidityDailyHistory} color="#a78bfa" unit="%" normalRange={{ low: 60, high: 100 }} />
              <HistoryChart title="Flow Rate - Daily Range" data={flowDailyHistory} color="#34d399" unit=" L/min" normalRange={{ low: 0.5, high: 5 }} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <ColorDailyChart title="Color Sensor RGB - Daily Range" data={colorDailyData} />

              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="mb-4 text-sm font-medium text-muted-foreground">Telemetry Durability</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">SD Card Status</span>
                    <span className={`text-sm font-medium ${reading.sdCardActive ? "text-primary" : "text-destructive"}`}>
                      {reading.sdCardActive ? "Active" : "Not Detected"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Storage State</span>
                    <span className={`text-sm font-medium ${reading.sdCardWriting ? "text-yellow-500" : "text-primary"}`}>
                      {reading.sdCardWriting ? "Writing..." : "Ready"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Storage Used</span>
                    <span className="text-sm font-mono text-foreground">{reading.sdCardUsage.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      ref={sdCardUsageRef}
                      className={`h-full rounded-full transition-all duration-300 w-[var(--sd-card-usage)] ${reading.sdCardUsage > 90 ? "bg-destructive" : reading.sdCardUsage > 70 ? "bg-yellow-500" : "bg-primary"}`}
                    />
                  </div>
                  <div className="rounded bg-secondary/50 p-3">
                    <p className="text-xs text-muted-foreground">Log Format</p>
                    <code className="mt-1 block text-xs text-foreground">JSON lines + persisted dashboard history</code>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-secondary/50 p-2">
                      <p className="text-muted-foreground">Records Source</p>
                      <p className="font-mono text-foreground">ESP32 + Next.js disk store</p>
                    </div>
                    <div className="rounded bg-secondary/50 p-2">
                      <p className="text-muted-foreground">Log Interval</p>
                      <p className="font-mono text-foreground">2 sec real-time</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="mb-4 text-sm font-medium text-muted-foreground">Ingest Pipeline</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">1</div>
                    <div>
                      <p className="font-medium text-foreground">ESP32 Measures Sensors</p>
                      <p className="text-xs text-muted-foreground">DS18B20, pH, turbidity, flow, ultrasonic, TCS3200, and SD card logging.</p>
                    </div>
                  </div>
                  <div className="ml-4 h-6 w-px bg-border" />
                  <div className="flex items-center gap-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">2</div>
                    <div>
                      <p className="font-medium text-foreground">POST /api/ingest</p>
                      <p className="text-xs text-muted-foreground">The ingest API accepts only the correct device ID and API key, then persists readings to disk-backed history.</p>
                    </div>
                  </div>
                  <div className="ml-4 h-6 w-px bg-border" />
                  <div className="flex items-center gap-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">3</div>
                    <div>
                      <p className="font-medium text-foreground">Dashboard Polls /api/latest</p>
                      <p className="text-xs text-muted-foreground">When the dashboard UI comes back online, it refetches stored history and redraws the charts from persisted data.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="configuration" className="space-y-6">
            <CalibrationPanel
              sensorReading={{
                hasWater: reading.hasWater,
                phVoltage: reading.phVoltage,
                turbidityVoltage: reading.turbidityVoltage,
                colorR: reading.colorR,
                colorG: reading.colorG,
                colorB: reading.colorB,
                phSensorOk: reading.phSensorOk,
                turbiditySensorOk: reading.turbiditySensorOk,
                colorSensorOk: reading.colorSensorOk,
              }}
            />
            <PinConfiguration />
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="mb-4 text-sm font-medium text-muted-foreground">System Operational Logic</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3"><div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary">1</div><div><p className="font-medium text-foreground">ESP32 Connection Check</p><p className="text-xs text-muted-foreground">If the device stops posting, historical data remains available from stored records.</p></div></div>
                  <div className="flex items-start gap-3"><div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary">2</div><div><p className="font-medium text-foreground">Tank Level Check</p><p className="text-xs text-muted-foreground">If the ultrasonic sensor says the tank is empty, water-quality screening is paused and the ESP32 sends zeros for water-contact sensors.</p></div></div>
                  <div className="flex items-start gap-3"><div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary">3</div><div><p className="font-medium text-foreground">Authenticated Ingest</p><p className="text-xs text-muted-foreground">Only deviceId ESP32-WATER-01 with the configured API key can update the dashboard.</p></div></div>
                  <div className="flex items-start gap-3"><div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary">4</div><div><p className="font-medium text-foreground">Live Dashboard</p><p className="text-xs text-muted-foreground">The dashboard reloads persisted history so data is available from disk storage.</p></div></div>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="mb-4 text-sm font-medium text-muted-foreground">ESP32 Upload Checklist</h3>
                <div className="space-y-4">
                  <div className="rounded-lg border border-border/50 bg-secondary/20 p-3"><p className="font-medium text-foreground">1. Install libraries</p><p className="text-xs text-muted-foreground">ArduinoJson, OneWire, DallasTemperature, LiquidCrystal_I2C.</p></div>
                  <div className="rounded-lg border border-border/50 bg-secondary/20 p-3"><p className="font-medium text-foreground">2. Set dashboard URL</p><p className="text-xs text-muted-foreground">Change the SERVER_URL in the sketch to your computer's local IP on your Wi-Fi network.</p></div>
                  <div className="rounded-lg border border-border/50 bg-secondary/20 p-3"><p className="font-medium text-foreground">3. Add .env.local</p><p className="text-xs text-muted-foreground">Keep DASHBOARD_API_KEY=esp32-water-2026 in the project root so only your ESP32 can ingest.</p></div>
                  <div className="rounded-lg border border-border/50 bg-secondary/20 p-3"><p className="font-medium text-foreground">4. Start Next.js</p><p className="text-xs text-muted-foreground">Run npm install then npm run dev. The app now persists telemetry history in the local data folder.</p></div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
