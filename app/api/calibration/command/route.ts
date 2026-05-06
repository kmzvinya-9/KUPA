import { NextResponse } from "next/server"
import {
  completeCalibrationCommand,
  getCalibrationCommandState,
  getCalibrationState,
  isCalibrationCommand,
  queueCalibrationCommand,
  saveCalibrationState,
  resetCalibrationState,
  addCalibrationHistoryEntry,
  takePendingCalibrationCommand,
  type CalCommand,
  type CalibrationState,
} from "@/lib/calibration-store"
import { getLatestReading } from "@/lib/telemetry-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface CalibrationRequest {
  command?: CalCommand
  commandId?: string
  deviceId?: string
  apiKey?: string
  ok?: boolean
  message?: string
  temperatureReferenceC?: number
  calibration?: Partial<CalibrationState>
}

// Hardware constants (matching ESP32 sketch)
const TURBIDITY_VREF = 3.3
const PH_NEUTRAL_DEFAULT = 7.0
const PH_SLOPE = -5.7
const CALIBRATION_READING_STALE_MS = 4500

function readDeviceAuth(request: Request, body?: CalibrationRequest) {
  const url = new URL(request.url)
  return {
    apiKey:
      request.headers.get("x-api-key") ??
      url.searchParams.get("apiKey") ??
      body?.apiKey ??
      "",
    deviceId:
      request.headers.get("x-device-id") ??
      url.searchParams.get("deviceId") ??
      body?.deviceId ??
      "",
  }
}

function validateDeviceAuth(request: Request, body?: CalibrationRequest) {
  const expectedApiKey = process.env.DASHBOARD_API_KEY ?? "esp32-water-2026"
  const acceptedDeviceId = process.env.DEVICE_ID ?? "ESP32-WATER-01"
  const { apiKey, deviceId } = readDeviceAuth(request, body)

  if (apiKey !== expectedApiKey) {
    return { ok: false as const, response: NextResponse.json({ ok: false, message: "Invalid API key" }, { status: 401 }) }
  }

  if (deviceId !== acceptedDeviceId) {
    return { ok: false as const, response: NextResponse.json({ ok: false, message: "Invalid device ID" }, { status: 403 }) }
  }

  return { ok: true as const, deviceId }
}

function withHardwareCommand(message: string, command: ReturnType<typeof queueCalibrationCommand>) {
  return `${message}. ESP32 command queued; waiting for hardware response (${command.id}).`
}

function isLiveReading(reading: ReturnType<typeof getLatestReading>): reading is NonNullable<ReturnType<typeof getLatestReading>> {
  return Boolean(reading && Date.now() - reading.receivedAt <= CALIBRATION_READING_STALE_MS)
}

function toFiniteNumber(value: unknown) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

async function readCalibrationRequest(request: Request): Promise<CalibrationRequest | NextResponse> {
  const rawText = await request.text()

  if (!rawText.trim()) {
    return NextResponse.json(
      { ok: false, message: "Empty calibration request body" },
      { status: 400 }
    )
  }

  try {
    return JSON.parse(rawText) as CalibrationRequest
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? `Invalid calibration JSON: ${error.message}` : "Invalid calibration JSON",
      },
      { status: 400 }
    )
  }
}

function normalizeTankDistances(emptyDistanceCm: number, fullDistanceCm: number) {
  const empty = Math.max(0, Math.min(emptyDistanceCm, 500))
  let full = Math.max(0, Math.min(fullDistanceCm, 500))

  if (full >= empty - 0.5) {
    full = Math.max(0, empty - 10)
  }

  return {
    tankEmptyDistanceCm: empty,
    tankFullDistanceCm: full,
  }
}

export async function GET(request: Request) {
  try {
    const hasDeviceAuth =
      request.headers.has("x-api-key") ||
      request.headers.has("x-device-id") ||
      new URL(request.url).searchParams.has("apiKey") ||
      new URL(request.url).searchParams.has("deviceId")

    if (hasDeviceAuth) {
      const auth = validateDeviceAuth(request)
      if (!auth.ok) return auth.response

      const command = takePendingCalibrationCommand(auth.deviceId)
      return NextResponse.json({
        ok: true,
        command: command
          ? {
              id: command.id,
              command: command.command,
              calibration: command.calibration,
              requestedAt: command.requestedAt,
            }
          : null,
      })
    }

    return NextResponse.json({
      ok: true,
      command: getCalibrationCommandState(),
    })
  } catch (error) {
    console.error("Error fetching calibration command:", error)
    return NextResponse.json(
      { ok: false, message: "Failed to fetch calibration command" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const parsedBody = await readCalibrationRequest(request)
    if (parsedBody instanceof NextResponse) return parsedBody

    const body = parsedBody
    const { command } = body

    if (body.commandId) {
      const auth = validateDeviceAuth(request, body)
      if (!auth.ok) return auth.response

      const completed = completeCalibrationCommand(
        body.commandId,
        Boolean(body.ok),
        body.message || (body.ok ? "ESP32 completed calibration command" : "ESP32 reported calibration failure")
      )

      if (!completed) {
        return NextResponse.json(
          { ok: false, message: "Calibration command ID was not found" },
          { status: 404 }
        )
      }

      if (body.calibration) {
        saveCalibrationState(body.calibration)
      }

      addCalibrationHistoryEntry(`esp32 ${completed.command}`, body.calibration ?? {})

      return NextResponse.json({
        ok: true,
        message: completed.message,
        command: completed,
      })
    }

    if (!isCalibrationCommand(command)) {
      return NextResponse.json(
        { ok: false, message: "A valid calibration command is required" },
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
        if (!isLiveReading(latestReading) || !latestReading?.hasWater || !latestReading.phSensorOk) {
          return NextResponse.json(
            {
              ok: false,
              message: "pH calibration requires live ESP32 telemetry, water present, and a working pH sensor",
            },
            { status: 400 }
          )
        }

        const voltage = latestReading.phVoltage
        const newOffset = PH_NEUTRAL_DEFAULT - (PH_SLOPE * voltage)

        const updated = saveCalibrationState({ phOffset: newOffset })
        addCalibrationHistoryEntry("cal ph7", { phOffset: newOffset })
        const hardwareCommand = queueCalibrationCommand(command)

        return NextResponse.json({
          ok: true,
          message: withHardwareCommand(`pH calibrated to 7.0 at ${voltage.toFixed(3)}V. New offset: ${newOffset.toFixed(4)}`, hardwareCommand),
          hardwareCommand,
          ...updated,
        })
      }

      case "cal turbidity-clear": {
        if (!isLiveReading(latestReading) || !latestReading?.hasWater || !latestReading.turbiditySensorOk) {
          return NextResponse.json(
            {
              ok: false,
              message: "Turbidity clear calibration requires live ESP32 telemetry, water present, and a working turbidity sensor",
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
        const hardwareCommand = queueCalibrationCommand(command)

        return NextResponse.json({
          ok: true,
          message: withHardwareCommand(`Turbidity clear calibrated at ${clampedVoltage.toFixed(3)}V`, hardwareCommand),
          hardwareCommand,
          ...updated,
        })
      }

      case "cal turbidity-dirty": {
        if (!isLiveReading(latestReading) || !latestReading?.hasWater || !latestReading.turbiditySensorOk) {
          return NextResponse.json(
            {
              ok: false,
              message: "Turbidity dirty calibration requires live ESP32 telemetry, water present, and a working turbidity sensor",
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
        const hardwareCommand = queueCalibrationCommand(command)

        return NextResponse.json({
          ok: true,
          message: withHardwareCommand(`Turbidity dirty calibrated at ${clampedVoltage.toFixed(3)}V`, hardwareCommand),
          hardwareCommand,
          ...updated,
        })
      }

      case "cal color": {
        if (!isLiveReading(latestReading) || !latestReading?.hasWater || !latestReading.colorSensorOk) {
          return NextResponse.json(
            {
              ok: false,
              message: "Color calibration requires live ESP32 telemetry, water present, and a working color sensor",
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
        const hardwareCommand = queueCalibrationCommand(command)

        return NextResponse.json({
          ok: true,
          message: withHardwareCommand(`Color baseline captured: R=${latestReading.colorR}, G=${latestReading.colorG}, B=${latestReading.colorB}`, hardwareCommand),
          hardwareCommand,
          ...updated,
        })
      }

      case "cal tank-empty": {
        if (!isLiveReading(latestReading) || !latestReading.ultrasonicSensorOk) {
          return NextResponse.json(
            {
              ok: false,
              message: "Tank empty calibration requires live ESP32 telemetry and a working ultrasonic tank sensor",
            },
            { status: 400 }
          )
        }

        const tankDistanceCm = toFiniteNumber(latestReading.tankDistanceCm)
        if (tankDistanceCm === null || tankDistanceCm <= 0) {
          return NextResponse.json(
            {
              ok: false,
              message: "Tank empty calibration requires updated ESP32 firmware that reports tank distance",
            },
            { status: 400 }
          )
        }

        const tankCalibration = normalizeTankDistances(tankDistanceCm, currentCalibration.tankFullDistanceCm)
        const updated = saveCalibrationState(tankCalibration)
        addCalibrationHistoryEntry("cal tank-empty", tankCalibration)
        const hardwareCommand = queueCalibrationCommand(command)

        return NextResponse.json({
          ok: true,
          message: withHardwareCommand(`Empty tank baseline captured at ${tankDistanceCm.toFixed(2)} cm`, hardwareCommand),
          hardwareCommand,
          ...updated,
        })
      }

      case "cal tank-full": {
        if (!isLiveReading(latestReading) || !latestReading.ultrasonicSensorOk) {
          return NextResponse.json(
            {
              ok: false,
              message: "Tank full calibration requires live ESP32 telemetry and a working ultrasonic tank sensor",
            },
            { status: 400 }
          )
        }

        const tankDistanceCm = toFiniteNumber(latestReading.tankDistanceCm)
        if (tankDistanceCm === null || tankDistanceCm <= 0) {
          return NextResponse.json(
            {
              ok: false,
              message: "Tank full calibration requires updated ESP32 firmware that reports tank distance",
            },
            { status: 400 }
          )
        }

        const tankCalibration = normalizeTankDistances(currentCalibration.tankEmptyDistanceCm, tankDistanceCm)
        const updated = saveCalibrationState(tankCalibration)
        addCalibrationHistoryEntry("cal tank-full", tankCalibration)
        const hardwareCommand = queueCalibrationCommand(command)

        return NextResponse.json({
          ok: true,
          message: withHardwareCommand(`Full tank baseline captured at ${tankDistanceCm.toFixed(2)} cm`, hardwareCommand),
          hardwareCommand,
          ...updated,
        })
      }

      case "cal temperature": {
        if (!isLiveReading(latestReading) || !latestReading.temperatureSensorOk) {
          return NextResponse.json(
            {
              ok: false,
              message: "Temperature calibration requires live ESP32 telemetry and a working DS18B20 sensor",
            },
            { status: 400 }
          )
        }

        const referenceC = toFiniteNumber(body.temperatureReferenceC)
        if (referenceC === null || referenceC < -50 || referenceC > 125) {
          return NextResponse.json(
            {
              ok: false,
              message: "Temperature calibration requires a reference between -50°C and 125°C",
            },
            { status: 400 }
          )
        }

        const rawTemperatureC = latestReading.temperatureC - currentCalibration.temperatureOffsetC
        const temperatureOffsetC = Math.max(-20, Math.min(20, referenceC - rawTemperatureC))
        const temperatureCalibration = { temperatureOffsetC }
        const updated = saveCalibrationState(temperatureCalibration)
        addCalibrationHistoryEntry("cal temperature", temperatureCalibration)
        const hardwareCommand = queueCalibrationCommand(command, temperatureCalibration)

        return NextResponse.json({
          ok: true,
          message: withHardwareCommand(`Temperature offset set to ${temperatureOffsetC.toFixed(2)}°C from ${referenceC.toFixed(1)}°C reference`, hardwareCommand),
          hardwareCommand,
          ...updated,
        })
      }

      case "cal all": {
        if (!isLiveReading(latestReading) || !latestReading?.hasWater) {
          return NextResponse.json(
            {
              ok: false,
              message: "All calibrations require live ESP32 telemetry and water present",
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
        const hardwareCommand = queueCalibrationCommand(command)

        return NextResponse.json({
          ok: true,
          message: withHardwareCommand("All sensors calibrated successfully", hardwareCommand),
          hardwareCommand,
          ...updated,
        })
      }

      case "cal reset": {
        const updated = resetCalibrationState()
        addCalibrationHistoryEntry("cal reset", {})
        const hardwareCommand = queueCalibrationCommand(command)

        return NextResponse.json({
          ok: true,
          message: withHardwareCommand("Calibration reset to factory defaults", hardwareCommand),
          hardwareCommand,
          ...updated,
        })
      }

      default:
        return NextResponse.json(
          {
            ok: false,
            message: `Unknown command: ${command}. Available commands: status, cal ph7, cal turbidity-clear, cal turbidity-dirty, cal color, cal tank-empty, cal tank-full, cal temperature, cal all, cal reset`,
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
