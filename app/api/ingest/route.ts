import { NextResponse } from 'next/server'
import { normalizeTelemetry, saveTelemetry } from '@/lib/telemetry-store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    // Get raw text first to handle empty bodies gracefully
    const rawText = await request.text()
    
    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Empty request body received' 
      }, { status: 400 })
    }
    
    // Parse JSON with better error handling
    let body: Record<string, unknown>
    try {
      body = JSON.parse(rawText) as Record<string, unknown>
    } catch (parseError) {
      return NextResponse.json({ 
        ok: false, 
        error: `Invalid JSON: ${(parseError as Error).message}` 
      }, { status: 400 })
    }
    
    const apiKeyFromHeader = request.headers.get('x-api-key')
    const expectedApiKey = process.env.DASHBOARD_API_KEY ?? 'esp32-water-2026'
    const acceptedDeviceId = process.env.DEVICE_ID ?? 'ESP32-WATER-01'
    const providedApiKey = apiKeyFromHeader ?? String(body.apiKey ?? '')
    const records = Array.isArray(body.records) ? body.records : [body]

    if (providedApiKey !== expectedApiKey) {
      return NextResponse.json({ ok: false, error: 'Invalid API key' }, { status: 401 })
    }

    let accepted = 0
    let duplicates = 0

    for (const candidate of records) {
      if (!candidate || typeof candidate !== 'object') {
        return NextResponse.json({ ok: false, error: 'Invalid record payload' }, { status: 400 })
      }

      const payload = candidate as Record<string, unknown>
      const deviceId = String(payload.deviceId ?? '')
      if (deviceId !== acceptedDeviceId) {
        return NextResponse.json({ ok: false, error: 'Invalid device ID' }, { status: 403 })
      }

      const reading = normalizeTelemetry(payload)
      const inserted = saveTelemetry(reading)
      if (inserted) accepted += 1
      else duplicates += 1
    }

    return NextResponse.json({
      ok: true,
      connected: true,
      accepted,
      duplicates,
      total: records.length,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Invalid JSON payload',
      },
      { status: 400 },
    )
  }
}
