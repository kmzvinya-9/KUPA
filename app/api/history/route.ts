import { NextResponse } from 'next/server'
import { getTelemetryHistory } from '@/lib/telemetry-store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const requestedLimit = Number(searchParams.get('limit') ?? '20000')
  const limit = Number.isFinite(requestedLimit) ? Math.min(20000, Math.max(1, Math.round(requestedLimit))) : 20000

  return NextResponse.json(
    { records: getTelemetryHistory(limit) },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    },
  )
}
