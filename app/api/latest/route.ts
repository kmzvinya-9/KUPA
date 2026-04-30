import { NextResponse } from 'next/server'
import { getDashboardPayload } from '@/lib/telemetry-store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const payload = getDashboardPayload()
    
    // Ensure we always return valid JSON, even if payload is empty
    if (!payload) {
      return NextResponse.json({
        connected: false,
        staleAfterMs: 15000,
        reading: {
          recordId: 'offline',
          deviceId: 'ESP32-WATER-01',
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
          batteryLevel: 0,
          batteryVoltage: 0,
          isCharging: false,
          pulseCount: 0,
          sdCardActive: false,
          sdCardWriting: false,
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
          screeningSummary: 'Server error - check logs',
        },
      })
    }
    
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    })
  } catch (error) {
    console.error('Error in /api/latest:', error)
    return NextResponse.json({
      connected: false,
      staleAfterMs: 15000,
      reading: {
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
        screeningSummary: 'Server error - check logs',
      },
    })
  }
}
