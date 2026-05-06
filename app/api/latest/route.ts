import { NextResponse } from 'next/server'
import { getDashboardPayload } from '@/lib/telemetry-store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DASHBOARD_STALE_AFTER_MS = 4500

const FALLBACK_READING = {
  recordId: 'error',
  deviceId: 'ESP32-WATER-01',
  timestamp: null,
  receivedAt: null,
  hasWater: false,
  temperatureC: 0,
  ph: 0,
  turbidityPercent: 0,
  flowRateLMin: 0,
  tankLevelPercent: 0,
  tankDistanceCm: 0,
  tankCapacity: 100,
  colorR: 0,
  colorG: 0,
  colorB: 0,
  lux: 0,
  batteryLevel: 0,
  batteryVoltage: 0,
  isCharging: false,
  pulseCount: 0,
  sdCardActive: false,
  sdCardWriting: false,
  sdCardSyncing: false,
  sdCardUsage: 0,
  uptimeSeconds: 0,
  pendingQueueCount: 0,
  temperatureSensorOk: false,
  phSensorOk: false,
  turbiditySensorOk: false,
  ultrasonicSensorOk: false,
  colorSensorOk: false,
  flowSensorState: 'unknown',
  sensorsForcedOff: false,
  phVoltage: 0,
  turbidityVoltage: 0,
  screeningScore: 0,
  screeningStatus: 'low',
  screeningSummary: 'Latest telemetry is temporarily unavailable.',
}

function latestJson(payload: unknown) {
  return NextResponse.json(payload, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  })
}

export async function GET() {
  try {
    const payload = getDashboardPayload()
    
    // Ensure we always return valid JSON, even if payload is empty
    if (!payload) {
      return latestJson({
        connected: false,
        staleAfterMs: DASHBOARD_STALE_AFTER_MS,
        reading: FALLBACK_READING,
      })
    }
    
    return latestJson(payload)
  } catch (error) {
    console.error('Error in /api/latest:', error)
    return latestJson({
      connected: false,
      staleAfterMs: DASHBOARD_STALE_AFTER_MS,
      reading: FALLBACK_READING,
    })
  }
}
