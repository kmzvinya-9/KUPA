"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { CheckCircle2, AlertTriangle, ActivitySquare } from "lucide-react"

type FlowSensorState = "active" | "idle" | "no_water" | "unknown"

interface SensorRecognitionPanelProps {
  hasWater: boolean
  phVoltage: number
  turbidityVoltage: number
  temperatureSensorOk: boolean
  phSensorOk: boolean
  turbiditySensorOk: boolean
  ultrasonicSensorOk: boolean
  colorSensorOk: boolean
  flowSensorState: FlowSensorState
  isConnected: boolean  // Added to know if ESP32 is connected
}

type SensorRow = {
  key: string
  name: string
  status: "recognized" | "standby" | "offline" | "check"
  detail: string
}

export function SensorRecognitionPanel({
  hasWater,
  phVoltage,
  turbidityVoltage,
  temperatureSensorOk,
  phSensorOk,
  turbiditySensorOk,
  ultrasonicSensorOk,
  colorSensorOk,
  flowSensorState,
  isConnected,
}: SensorRecognitionPanelProps) {
  const flowDetail = !hasWater
    ? "Waiting for water before flow verification"
    : flowSensorState === "active"
      ? "Pulse activity detected"
      : flowSensorState === "idle"
        ? "Sensor recognized, no current flow pulses"
        : "Flow signal status is unknown"

  // When ESP32 is offline, show all sensors as offline (not as "check wiring")
  const rows: SensorRow[] = [
    {
      key: "temp",
      name: "DS18B20 Temperature",
      status: !isConnected ? "offline" : temperatureSensorOk ? "recognized" : "check",
      detail: !isConnected ? "ESP32 offline - waiting for data" : (temperatureSensorOk ? "Digital sensor returning valid temperature" : "No valid DS18B20 reading"),
    },
    {
      key: "ph",
      name: "pH Probe",
      status: !isConnected ? "offline" : !hasWater ? "standby" : phSensorOk ? "recognized" : "check",
      detail: !isConnected ? "ESP32 offline - waiting for data" : (hasWater ? (phSensorOk ? `Signal present at ${phVoltage.toFixed(2)} V` : "No stable pH probe signal") : "Waiting for water sample before pH verification"),
    },
    {
      key: "turbidity",
      name: "Turbidity Sensor",
      status: !isConnected ? "offline" : !hasWater ? "standby" : turbiditySensorOk ? "recognized" : "check",
      detail: !isConnected ? "ESP32 offline - waiting for data" : (hasWater ? (turbiditySensorOk ? `Analog signal present at ${turbidityVoltage.toFixed(2)} V` : "No stable turbidity signal") : "Waiting for water sample before turbidity verification"),
    },
    {
      key: "ultrasonic",
      name: "Ultrasonic Level",
      status: !isConnected ? "offline" : ultrasonicSensorOk ? "recognized" : "check",
      detail: !isConnected ? "ESP32 offline - waiting for data" : (ultrasonicSensorOk ? "Distance echo detected" : "No ultrasonic echo received"),
    },
    {
      key: "color",
      name: "TCS3200 / TCS230 Color",
      status: !isConnected ? "offline" : !hasWater ? "standby" : colorSensorOk ? "recognized" : "check",
      detail: !isConnected ? "ESP32 offline - waiting for data" : (hasWater ? (colorSensorOk ? "RGB pulse outputs detected" : "No color pulse response detected") : "Waiting for water sample before color verification"),
    },
    {
      key: "flow",
      name: "Flow Sensor",
      status: !isConnected ? "offline" : !hasWater ? "standby" : flowSensorState !== "unknown" ? "recognized" : "check",
      detail: !isConnected ? "ESP32 offline - waiting for data" : flowDetail,
    },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <ActivitySquare className="h-4 w-4" />
          Sensor Recognition
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.key} className="rounded-lg border border-border/60 bg-secondary/10 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{row.name}</p>
                  <p className="text-xs text-muted-foreground">{row.detail}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {row.status === "offline" ? (
                    <>
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="text-xs font-medium text-yellow-500">Offline</span>
                    </>
                  ) : row.status === "recognized" ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium text-primary">Recognized</span>
                    </>
                  ) : row.status === "standby" ? (
                    <>
                      <ActivitySquare className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Standby</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <span className="text-xs font-medium text-destructive">Check wiring</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
