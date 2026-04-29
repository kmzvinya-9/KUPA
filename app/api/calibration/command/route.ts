import { NextResponse } from "next/server"
import {
  getCalibrationState,
  saveCalibrationState,
  resetCalibrationState,
  addCalibrationHistoryEntry,
} from "@/lib/calibration-store"
import { getLatestReading } from "@/lib/telemetry-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type CalCommand =
  | "status"
  | "cal ph7"
  | "cal turbidity-clear"
  | "cal turbidity-dirty"
  | "cal color"
  | "cal all"
  | "cal reset"

interface CalibrationRequest {
  command: CalCommand
}

// Hardware constants (matching ESP32 sketch)
const TURBIDITY_VREF = 3.3
const PH_NEUTRAL_DEFAULT = 7.0
const PH_SLOPE = -5.7

export async function POST(request: Request) {
  try {
    const body: CalibrationRequest = await request.json()
    const { command } = body

    if (!command) {
      return NextResponse.json(
        { ok: false, message: "Command is required" },
        { status: 400 }
      )
    }

    const currentCalibration = getCalibrationState()
    const latestReading = getLatestReading()

    switch (command) {
      case "status": {
        return NextResponse.json({
          ok: true,
          message: "Calibration status retrieved",
          ...currentCalibration,
        })
      }

      case "cal ph7": {
        if (!latestReading || !latestReading.hasWater || !latestReading.phSensorOk) {
          return NextResponse.json(
            {
              ok: false,
              message: "pH calibration requires water present and a working pH sensor",
            },
            { status: 400 }
          )
        }

        const voltage = latestReading.phVoltage
        const newOffset = PH_NEUTRAL_DEFAULT - (PH_SLOPE * voltage)

        const updated = saveCalibrationState({ phOffset: newOffset })
        addCalibrationHistoryEntry("cal ph7", { phOffset: newOffset })

        return NextResponse.json({
          ok: true,
          message: `pH calibrated to 7.0 at ${voltage.toFixed(3)}V. New offset: ${newOffset.toFixed(4)}`,
          ...updated,
        })
      }

      case "cal turbidity-clear": {
        if (!latestReading || !latestReading.hasWater || !latestReading.turbiditySensorOk) {
          return NextResponse.json(
            {
              ok: false,
              message: "Turbidity clear calibration requires water present and a working turbidity sensor",
            },
            { status: 400 }
          )
        }

        const voltage = latestReading.turbidityVoltage
        const clampedVoltage = Math.max(0, Math.min(voltage, TURBIDITY_VREF))

        let newDirtyVoltage = currentCalibration.turbidityDirtyVoltage
        if (clampedVoltage <= newDirtyVoltage) {
          newDirtyVoltage = Math.max(0, clampedVoltage - 0.1)
        }

        const updated = saveCalibrationState({
          turbidityClearVoltage: clampedVoltage,
          turbidityDirtyVoltage: newDirtyVoltage,
        })
        addCalibrationHistoryEntry("cal turbidity-clear", {
          turbidityClearVoltage: clampedVoltage,
          turbidityDirtyVoltage: newDirtyVoltage,
        })

        return NextResponse.json({
          ok: true,
          message: `Turbidity clear calibrated at ${clampedVoltage.toFixed(3)}V`,
          ...updated,
        })
      }

      case "cal turbidity-dirty": {
        if (!latestReading || !latestReading.hasWater || !latestReading.turbiditySensorOk) {
          return NextResponse.json(
            {
              ok: false,
              message: "Turbidity dirty calibration requires water present and a working turbidity sensor",
            },
            { status: 400 }
          )
        }

        const voltage = latestReading.turbidityVoltage
        const clampedVoltage = Math.max(0, Math.min(voltage, TURBIDITY_VREF))

        let newClearVoltage = currentCalibration.turbidityClearVoltage
        if (clampedVoltage >= newClearVoltage) {
          newClearVoltage = Math.min(TURBIDITY_VREF, clampedVoltage + 0.1)
        }

        const updated = saveCalibrationState({
          turbidityClearVoltage: newClearVoltage,
          turbidityDirtyVoltage: clampedVoltage,
        })
        addCalibrationHistoryEntry("cal turbidity-dirty", {
          turbidityClearVoltage: newClearVoltage,
          turbidityDirtyVoltage: clampedVoltage,
        })

        return NextResponse.json({
          ok: true,
          message: `Turbidity dirty calibrated at ${clampedVoltage.toFixed(3)}V`,
          ...updated,
        })
      }

      case "cal color": {
        if (!latestReading || !latestReading.hasWater || !latestReading.colorSensorOk) {
          return NextResponse.json(
            {
              ok: false,
              message: "Color calibration requires water present and a working color sensor",
            },
            { status: 400 }
          )
        }

        const updated = saveCalibrationState({
          colorBaselineR: latestReading.colorR,
          colorBaselineG: latestReading.colorG,
          colorBaselineB: latestReading.colorB,
          colorBaselineReady: true,
        })
        addCalibrationHistoryEntry("cal color", {
          colorBaselineR: latestReading.colorR,
          colorBaselineG: latestReading.colorG,
          colorBaselineB: latestReading.colorB,
          colorBaselineReady: true,
        })

        return NextResponse.json({
          ok: true,
          message: `Color baseline captured: R=${latestReading.colorR}, G=${latestReading.colorG}, B=${latestReading.colorB}`,
          ...updated,
        })
      }

      case "cal all": {
        if (!latestReading || !latestReading.hasWater) {
          return NextResponse.json(
            {
              ok: false,
              message: "All calibrations require water present",
            },
            { status: 400 }
          )
        }

        if (!latestReading.phSensorOk || !latestReading.turbiditySensorOk || !latestReading.colorSensorOk) {
          return NextResponse.json(
            {
              ok: false,
              message: "All calibrations require all sensors to be working",
            },
            { status: 400 }
          )
        }

        // Calibrate pH
        const phVoltage = latestReading.phVoltage
        const newPhOffset = PH_NEUTRAL_DEFAULT - (PH_SLOPE * phVoltage)

        // Calibrate turbidity clear
        const turbVoltage = latestReading.turbidityVoltage
        const clampedTurbVoltage = Math.max(0, Math.min(turbVoltage, TURBIDITY_VREF))

        // Calibrate color
        const updated = saveCalibrationState({
          phOffset: newPhOffset,
          turbidityClearVoltage: clampedTurbVoltage,
          turbidityDirtyVoltage: Math.max(0, clampedTurbVoltage - 0.1),
          colorBaselineR: latestReading.colorR,
          colorBaselineG: latestReading.colorG,
          colorBaselineB: latestReading.colorB,
          colorBaselineReady: true,
        })

        addCalibrationHistoryEntry("cal all", {
          phOffset: newPhOffset,
          turbidityClearVoltage: clampedTurbVoltage,
          colorBaselineR: latestReading.colorR,
          colorBaselineG: latestReading.colorG,
          colorBaselineB: latestReading.colorB,
        })

        return NextResponse.json({
          ok: true,
          message: "All sensors calibrated successfully",
          ...updated,
        })
      }

      case "cal reset": {
        const updated = resetCalibrationState()
        addCalibrationHistoryEntry("cal reset", {})

        return NextResponse.json({
          ok: true,
          message: "Calibration reset to factory defaults",
          ...updated,
        })
      }

      default:
        return NextResponse.json(
          {
            ok: false,
            message: `Unknown command: ${command}. Available commands: status, cal ph7, cal turbidity-clear, cal turbidity-dirty, cal color, cal all, cal reset`,
          },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error("Error processing calibration command:", error)
    return NextResponse.json(
      { ok: false, message: "Internal server error processing calibration command" },
      { status: 500 }
    )
  }
}