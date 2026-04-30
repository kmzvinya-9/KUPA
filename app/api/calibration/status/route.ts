import { NextResponse } from "next/server"
import { getCalibrationState } from "@/lib/calibration-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    const calibration = getCalibrationState()
    return NextResponse.json({
      ok: true,
      ...calibration,
    })
  } catch (error) {
    console.error("Error fetching calibration status:", error)
    return NextResponse.json(
      { ok: false, message: "Failed to fetch calibration status" },
      { status: 500 }
    )
  }
}