"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import {
  ActivitySquare,
  Droplet,
  Thermometer,
  TestTube2,
  Palette,
  RotateCcw,
  Save,
  Waves,
  Info,
  CheckCircle2,
  AlertTriangle,
  Loader,
} from "lucide-react"

type CalibrationStatus = {
  phOffset: number
  turbidityClearVoltage: number
  turbidityDirtyVoltage: number
  colorBaselineR: number
  colorBaselineG: number
  colorBaselineB: number
  colorBaselineReady: boolean
  tankEmptyDistanceCm: number
  tankFullDistanceCm: number
  temperatureOffsetC: number
}

type CalibrationCommandState = {
  id: string
  command: CalCommand
  status: "pending" | "sent" | "completed" | "failed"
  requestedAt: string
  updatedAt: string
  sentAt?: string
  completedAt?: string
  deviceId?: string
  ok?: boolean
  message?: string
}

type SensorReading = {
  hasWater: boolean
  temperatureC: number
  tankLevelPercent: number
  tankDistanceCm: number
  tankCapacity: number
  phVoltage: number
  turbidityVoltage: number
  colorR: number
  colorG: number
  colorB: number
  temperatureSensorOk: boolean
  phSensorOk: boolean
  turbiditySensorOk: boolean
  ultrasonicSensorOk: boolean
  colorSensorOk: boolean
}

interface CalibrationPanelProps {
  sensorReading: SensorReading
  isConnected: boolean
}

type CalCommand =
  | "status"
  | "cal ph7"
  | "cal turbidity-clear"
  | "cal turbidity-dirty"
  | "cal color"
  | "cal tank-empty"
  | "cal tank-full"
  | "cal temperature"
  | "cal all"
  | "cal reset"

export function CalibrationPanel({ sensorReading, isConnected }: CalibrationPanelProps) {
  const [status, setStatus] = useState<CalibrationStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null)
  const [activeTab, setActiveTab] = useState("ph")
  const [hardwareCommand, setHardwareCommand] = useState<CalibrationCommandState | null>(null)
  const [temperatureReferenceC, setTemperatureReferenceC] = useState("25.0")
  const hardwareCommandId = hardwareCommand?.id ?? "none"
  const hardwareCommandStatus = hardwareCommand?.status ?? "idle"

  const fetchCalibrationStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/calibration/status", { cache: "no-store" })
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
      }
    } catch (error) {
      console.error("Failed to fetch calibration status:", error)
    }
  }, [])

  const fetchHardwareCommandStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/calibration/command", { cache: "no-store" })
      if (!response.ok) return
      const data = (await response.json()) as { command?: CalibrationCommandState | null }
      setHardwareCommand(data.command ?? null)
    } catch (error) {
      console.error("Failed to fetch calibration command status:", error)
    }
  }, [])

  useEffect(() => {
    fetchCalibrationStatus()
    fetchHardwareCommandStatus()
  }, [fetchCalibrationStatus, fetchHardwareCommandStatus])

  useEffect(() => {
    if (!hardwareCommand || (hardwareCommand.status !== "pending" && hardwareCommand.status !== "sent")) return
    const interval = window.setInterval(() => {
      void fetchHardwareCommandStatus()
      void fetchCalibrationStatus()
    }, 1000)
    return () => window.clearInterval(interval)
  }, [fetchCalibrationStatus, fetchHardwareCommandStatus, hardwareCommandId, hardwareCommandStatus])

  const sendCalibrationCommand = async (command: CalCommand, extraBody: Record<string, unknown> = {}) => {
    setIsLoading(true)
    setMessage(null)

    try {
      const response = await fetch("/api/calibration/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, ...extraBody }),
      })

      const result = await response.json()

      if (result.ok) {
        setMessage({ type: "success", text: result.message })
        setHardwareCommand(result.hardwareCommand ?? result.command ?? null)
        fetchCalibrationStatus()
        fetchHardwareCommandStatus()
      } else {
        setMessage({ type: "error", text: result.message || "Calibration command failed" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to send calibration command" })
    } finally {
      setIsLoading(false)
    }
  }

  const isHardwareBusy = hardwareCommand?.status === "pending" || hardwareCommand?.status === "sent"

  const hardwareStatus = (() => {
    if (!hardwareCommand) return null
    if (hardwareCommand.status === "completed") {
      return { type: "success" as const, label: "ESP32 responded", text: hardwareCommand.message ?? "Calibration command completed on the ESP32." }
    }
    if (hardwareCommand.status === "failed") {
      return { type: "error" as const, label: "ESP32 failed", text: hardwareCommand.message ?? "The ESP32 reported that calibration could not be completed." }
    }
    if (hardwareCommand.status === "sent") {
      return { type: "info" as const, label: "Sent to ESP32", text: hardwareCommand.message ?? "Waiting for the ESP32 calibration response." }
    }
    return { type: "info" as const, label: "Queued for ESP32", text: hardwareCommand.message ?? "Waiting for the ESP32 to collect the calibration command." }
  })()

  const getPhStatus = () => {
    if (!sensorReading.hasWater) {
      return { status: "warning", message: "No water detected - pH calibration requires water sample" }
    }
    if (!sensorReading.phSensorOk) {
      return { status: "error", message: "pH sensor not recognized - check wiring" }
    }
    return {
      status: "ok",
      message: `Current pH voltage: ${sensorReading.phVoltage.toFixed(3)} V`,
    }
  }

  const getTurbidityStatus = () => {
    if (!sensorReading.hasWater) {
      return { status: "warning", message: "No water detected - turbidity calibration requires water sample" }
    }
    if (!sensorReading.turbiditySensorOk) {
      return { status: "error", message: "Turbidity sensor not recognized - check wiring" }
    }
    return {
      status: "ok",
      message: `Current turbidity voltage: ${sensorReading.turbidityVoltage.toFixed(3)} V`,
    }
  }

  const getColorStatus = () => {
    if (!sensorReading.hasWater) {
      return { status: "warning", message: "No water detected - color calibration requires water sample" }
    }
    if (!sensorReading.colorSensorOk) {
      return { status: "error", message: "Color sensor not recognized - check wiring" }
    }
    return {
      status: "ok",
      message: `Current RGB: R=${sensorReading.colorR}, G=${sensorReading.colorG}, B=${sensorReading.colorB}`,
    }
  }

  const getTankStatus = () => {
    if (!isConnected) {
      return { status: "error", message: "ESP32 is offline - tank calibration requires live ultrasonic readings" }
    }
    if (!sensorReading.ultrasonicSensorOk) {
      return { status: "error", message: "Ultrasonic tank sensor not recognized - check trigger/echo wiring" }
    }
    if (sensorReading.tankDistanceCm <= 0) {
      return { status: "warning", message: "Waiting for an ultrasonic distance reading from updated ESP32 firmware" }
    }
    return {
      status: "ok",
      message: `Current tank level: ${sensorReading.tankLevelPercent.toFixed(1)}%`,
    }
  }

  const getTemperatureStatus = () => {
    if (!isConnected) {
      return { status: "error", message: "ESP32 is offline - temperature calibration requires live readings" }
    }
    if (!sensorReading.temperatureSensorOk) {
      return { status: "error", message: "DS18B20 temperature sensor not recognized - check wiring" }
    }
    return {
      status: "ok",
      message: `Current temperature: ${sensorReading.temperatureC.toFixed(2)} °C`,
    }
  }

  const parsedTemperatureReference = Number(temperatureReferenceC)
  const canCalibrateTemperature =
    Number.isFinite(parsedTemperatureReference) &&
    parsedTemperatureReference >= -50 &&
    parsedTemperatureReference <= 125 &&
    getTemperatureStatus().status === "ok"

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <ActivitySquare className="h-4 w-4" />
          Sensor Calibration
        </CardTitle>
        <CardDescription className="text-xs">
          Calibrate sensors for accurate readings. Commands are sent to the ESP32 via the dashboard API.
        </CardDescription>
        {hardwareStatus && (
          <Alert
            className={cn(
              "mt-3",
              hardwareStatus.type === "success" && "bg-primary/10 border-primary/30",
              hardwareStatus.type === "error" && "bg-destructive/10 border-destructive/30",
              hardwareStatus.type === "info" && "bg-info/10 border-info/30"
            )}
          >
            {hardwareStatus.type === "success" && <CheckCircle2 className="h-4 w-4 text-primary" />}
            {hardwareStatus.type === "error" && <AlertTriangle className="h-4 w-4 text-destructive" />}
            {hardwareStatus.type === "info" && (
              isHardwareBusy ? <Loader className="h-4 w-4 animate-spin text-info" /> : <Info className="h-4 w-4 text-info" />
            )}
            <AlertDescription
              className={cn(
                "text-xs",
                hardwareStatus.type === "success" && "text-primary",
                hardwareStatus.type === "error" && "text-destructive",
                hardwareStatus.type === "info" && "text-info"
              )}
            >
              <span className="font-medium">{hardwareStatus.label}:</span> {hardwareStatus.text}
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-3 gap-1 md:grid-cols-6">
            <TabsTrigger value="ph" className="text-xs">
              <Droplet className="h-3 w-3 mr-1" />
              pH
            </TabsTrigger>
            <TabsTrigger value="turbidity" className="text-xs">
              <TestTube2 className="h-3 w-3 mr-1" />
              Turbidity
            </TabsTrigger>
            <TabsTrigger value="color" className="text-xs">
              <Palette className="h-3 w-3 mr-1" />
              Color
            </TabsTrigger>
            <TabsTrigger value="tank" className="text-xs">
              <Waves className="h-3 w-3 mr-1" />
              Tank
            </TabsTrigger>
            <TabsTrigger value="temperature" className="text-xs">
              <Thermometer className="h-3 w-3 mr-1" />
              Temp
            </TabsTrigger>
            <TabsTrigger value="system" className="text-xs">
              <RotateCcw className="h-3 w-3 mr-1" />
              System
            </TabsTrigger>
          </TabsList>

          {/* pH Calibration */}
          <TabsContent value="ph" className="space-y-4">
            <div className="rounded-lg border border-border bg-secondary/10 p-4">
              <h4 className="text-sm font-medium text-foreground mb-2">pH Sensor Calibration</h4>
              <p className="text-xs text-muted-foreground mb-4">
                Calibrate the pH sensor using a pH 7.0 buffer solution for accurate readings.
              </p>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Current Offset:</span>
                  <Badge variant="outline" className="font-mono">
                    {status?.phOffset?.toFixed(4) ?? "N/A"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">pH Voltage:</span>
                  <Badge variant="outline" className="font-mono">
                    {sensorReading.phVoltage?.toFixed(3) ?? "0.000"} V
                  </Badge>
                </div>

                {getPhStatus().status === "ok" && (
                  <Alert className="bg-primary/10 border-primary/30">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-xs text-primary">{getPhStatus().message}</AlertDescription>
                  </Alert>
                )}
                {getPhStatus().status === "warning" && (
                  <Alert className="bg-yellow-500/10 border-yellow-500/30">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <AlertDescription className="text-xs text-yellow-500">{getPhStatus().message}</AlertDescription>
                  </Alert>
                )}
                {getPhStatus().status === "error" && (
                  <Alert className="bg-destructive/10 border-destructive/30">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <AlertDescription className="text-xs text-destructive">{getPhStatus().message}</AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="mt-4 space-y-2">
                <Button
                  onClick={() => sendCalibrationCommand("cal ph7")}
                  disabled={isLoading || isHardwareBusy || getPhStatus().status !== "ok"}
                  className="w-full"
                  size="sm"
                >
                  {isLoading ? (
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <TestTube2 className="h-4 w-4 mr-2" />
                  )}
                  Calibrate to pH 7.0
                </Button>
                <p className="text-[10px] text-muted-foreground">
                  Immerse pH probe in pH 7.0 buffer solution, wait for stable reading, then click calibrate.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Turbidity Calibration */}
          <TabsContent value="turbidity" className="space-y-4">
            <div className="rounded-lg border border-border bg-secondary/10 p-4">
              <h4 className="text-sm font-medium text-foreground mb-2">Turbidity Sensor Calibration</h4>
              <p className="text-xs text-muted-foreground mb-4">
                Calibrate using clear water (0% turbidity) and dirty water (100% turbidity) references.
              </p>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Clear Water Voltage (0%):</span>
                  <Badge variant="outline" className="font-mono">
                    {status?.turbidityClearVoltage?.toFixed(3) ?? "N/A"} V
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Dirty Water Voltage (100%):</span>
                  <Badge variant="outline" className="font-mono">
                    {status?.turbidityDirtyVoltage?.toFixed(3) ?? "N/A"} V
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Current Voltage:</span>
                  <Badge variant="outline" className="font-mono">
                    {sensorReading.turbidityVoltage?.toFixed(3) ?? "0.000"} V
                  </Badge>
                </div>

                {getTurbidityStatus().status === "ok" && (
                  <Alert className="bg-primary/10 border-primary/30">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-xs text-primary">{getTurbidityStatus().message}</AlertDescription>
                  </Alert>
                )}
                {getTurbidityStatus().status === "warning" && (
                  <Alert className="bg-yellow-500/10 border-yellow-500/30">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <AlertDescription className="text-xs text-yellow-500">{getTurbidityStatus().message}</AlertDescription>
                  </Alert>
                )}
                {getTurbidityStatus().status === "error" && (
                  <Alert className="bg-destructive/10 border-destructive/30">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <AlertDescription className="text-xs text-destructive">{getTurbidityStatus().message}</AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="mt-4 space-y-3">
                <Button
                  onClick={() => sendCalibrationCommand("cal turbidity-clear")}
                  disabled={isLoading || isHardwareBusy || getTurbidityStatus().status !== "ok"}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  {isLoading ? (
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Droplet className="h-4 w-4 mr-2" />
                  )}
                  Calibrate Clear Water (0%)
                </Button>
                <p className="text-[10px] text-muted-foreground">
                  Use distilled or very clear water as the 0% turbidity reference.
                </p>

                <Button
                  onClick={() => sendCalibrationCommand("cal turbidity-dirty")}
                  disabled={isLoading || isHardwareBusy || getTurbidityStatus().status !== "ok"}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  {isLoading ? (
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <TestTube2 className="h-4 w-4 mr-2" />
                  )}
                  Calibrate Dirty Water (100%)
                </Button>
                <p className="text-[10px] text-muted-foreground">
                  Use very turbid water (e.g., with added clay or sediment) as the 100% reference.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Color Calibration */}
          <TabsContent value="color" className="space-y-4">
            <div className="rounded-lg border border-border bg-secondary/10 p-4">
              <h4 className="text-sm font-medium text-foreground mb-2">Color Sensor Calibration</h4>
              <p className="text-xs text-muted-foreground mb-4">
                Calibrate the TCS3200/TCS230 color sensor baseline for accurate RGB readings.
              </p>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Baseline Ready:</span>
                  <Badge variant={status?.colorBaselineReady ? "default" : "secondary"} className="text-xs">
                    {status?.colorBaselineReady ? "Yes" : "No"}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 rounded bg-red-500/10 border border-red-500/30">
                    <p className="text-xs text-red-500">Red</p>
                    <p className="text-sm font-mono font-medium text-foreground">
                      {status?.colorBaselineR?.toFixed(1) ?? "255.0"}
                    </p>
                  </div>
                  <div className="text-center p-2 rounded bg-green-500/10 border border-green-500/30">
                    <p className="text-xs text-green-500">Green</p>
                    <p className="text-sm font-mono font-medium text-foreground">
                      {status?.colorBaselineG?.toFixed(1) ?? "255.0"}
                    </p>
                  </div>
                  <div className="text-center p-2 rounded bg-blue-500/10 border border-blue-500/30">
                    <p className="text-xs text-blue-500">Blue</p>
                    <p className="text-sm font-mono font-medium text-foreground">
                      {status?.colorBaselineB?.toFixed(1) ?? "255.0"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Current RGB:</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    R:{sensorReading.colorR} G:{sensorReading.colorG} B:{sensorReading.colorB}
                  </Badge>
                </div>

                {getColorStatus().status === "ok" && (
                  <Alert className="bg-primary/10 border-primary/30">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-xs text-primary">{getColorStatus().message}</AlertDescription>
                  </Alert>
                )}
                {getColorStatus().status === "warning" && (
                  <Alert className="bg-yellow-500/10 border-yellow-500/30">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <AlertDescription className="text-xs text-yellow-500">{getColorStatus().message}</AlertDescription>
                  </Alert>
                )}
                {getColorStatus().status === "error" && (
                  <Alert className="bg-destructive/10 border-destructive/30">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <AlertDescription className="text-xs text-destructive">{getColorStatus().message}</AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="mt-4 space-y-2">
                <Button
                  onClick={() => sendCalibrationCommand("cal color")}
                  disabled={isLoading || isHardwareBusy || getColorStatus().status !== "ok"}
                  className="w-full"
                  size="sm"
                >
                  {isLoading ? (
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Palette className="h-4 w-4 mr-2" />
                  )}
                  Capture Color Baseline
                </Button>
                <p className="text-[10px] text-muted-foreground">
                  Capture the current RGB values as the new baseline for color normalization.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Tank Calibration */}
          <TabsContent value="tank" className="space-y-4">
            <div className="rounded-lg border border-border bg-secondary/10 p-4">
              <h4 className="text-sm font-medium text-foreground mb-2">Tank Sensor Calibration</h4>
              <p className="text-xs text-muted-foreground mb-4">
                Capture ultrasonic distance baselines for the empty tank initial condition and full tank reference.
              </p>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Empty Baseline:</span>
                  <Badge variant="outline" className="font-mono">
                    {status?.tankEmptyDistanceCm?.toFixed(2) ?? "13.00"} cm
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Full Baseline:</span>
                  <Badge variant="outline" className="font-mono">
                    {status?.tankFullDistanceCm?.toFixed(2) ?? "3.00"} cm
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Current Distance:</span>
                  <Badge variant="outline" className="font-mono">
                    {sensorReading.tankDistanceCm > 0 ? `${sensorReading.tankDistanceCm.toFixed(2)} cm` : "Waiting"}
                  </Badge>
                </div>

                {getTankStatus().status === "ok" ? (
                  <Alert className="bg-primary/10 border-primary/30">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-xs text-primary">{getTankStatus().message}</AlertDescription>
                  </Alert>
                ) : getTankStatus().status === "warning" ? (
                  <Alert className="bg-yellow-500/10 border-yellow-500/30">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <AlertDescription className="text-xs text-yellow-500">{getTankStatus().message}</AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="bg-destructive/10 border-destructive/30">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <AlertDescription className="text-xs text-destructive">{getTankStatus().message}</AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="mt-4 space-y-3">
                <Button
                  onClick={() => sendCalibrationCommand("cal tank-empty")}
                  disabled={isLoading || isHardwareBusy || getTankStatus().status !== "ok"}
                  className="w-full"
                  size="sm"
                >
                  {isLoading ? (
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Waves className="h-4 w-4 mr-2" />
                  )}
                  Capture Empty Tank Baseline
                </Button>
                <p className="text-[10px] text-muted-foreground">
                  Use this with no water in the tank to set the startup/initial empty condition.
                </p>

                <Button
                  onClick={() => sendCalibrationCommand("cal tank-full")}
                  disabled={isLoading || isHardwareBusy || getTankStatus().status !== "ok"}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  {isLoading ? (
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Capture Full Tank Baseline
                </Button>
                <p className="text-[10px] text-muted-foreground">
                  Fill to the normal full mark before capturing this reference.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Temperature Calibration */}
          <TabsContent value="temperature" className="space-y-4">
            <div className="rounded-lg border border-border bg-secondary/10 p-4">
              <h4 className="text-sm font-medium text-foreground mb-2">Temperature Sensor Calibration</h4>
              <p className="text-xs text-muted-foreground mb-4">
                Temperature is monitored independently from tank water state and can be offset against a known reference.
              </p>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Current Offset:</span>
                  <Badge variant="outline" className="font-mono">
                    {status?.temperatureOffsetC?.toFixed(2) ?? "0.00"} °C
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Current Temperature:</span>
                  <Badge variant="outline" className="font-mono">
                    {sensorReading.temperatureC.toFixed(2)} °C
                  </Badge>
                </div>

                {getTemperatureStatus().status === "ok" ? (
                  <Alert className="bg-primary/10 border-primary/30">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-xs text-primary">{getTemperatureStatus().message}</AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="bg-destructive/10 border-destructive/30">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <AlertDescription className="text-xs text-destructive">{getTemperatureStatus().message}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="temperature-reference" className="text-xs text-muted-foreground">
                    Reference Temperature (°C)
                  </Label>
                  <Input
                    id="temperature-reference"
                    inputMode="decimal"
                    value={temperatureReferenceC}
                    onChange={(event) => setTemperatureReferenceC(event.target.value)}
                    className="h-9 font-mono"
                  />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Button
                  onClick={() => sendCalibrationCommand("cal temperature", { temperatureReferenceC: parsedTemperatureReference })}
                  disabled={isLoading || isHardwareBusy || !canCalibrateTemperature}
                  className="w-full"
                  size="sm"
                >
                  {isLoading ? (
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Thermometer className="h-4 w-4 mr-2" />
                  )}
                  Calibrate Temperature Offset
                </Button>
                <p className="text-[10px] text-muted-foreground">
                  Compare the DS18B20 reading with a trusted thermometer, enter the trusted value, then calibrate.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* System Calibration */}
          <TabsContent value="system" className="space-y-4">
            <div className="rounded-lg border border-border bg-secondary/10 p-4">
              <h4 className="text-sm font-medium text-foreground mb-2">System Calibration Management</h4>
              <p className="text-xs text-muted-foreground mb-4">
                Run all calibrations at once or reset to factory defaults.
              </p>

              <div className="space-y-4">
                <Alert className="bg-info/10 border-info/30">
                  <Info className="h-4 w-4 text-info" />
                  <AlertDescription className="text-xs text-info">
                    <p className="font-medium mb-1">Calibration Tips:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Use an empty tank for tank-empty calibration and water/reference samples for water-contact sensors</li>
                      <li>Wait for sensor readings to stabilize before calibrating</li>
                      <li>Use known reference solutions for best accuracy</li>
                      <li>Recalibrate periodically for maintained accuracy</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Button
                    onClick={() => sendCalibrationCommand("cal all")}
                    disabled={isLoading || isHardwareBusy || !sensorReading.hasWater}
                    variant="outline"
                    className="w-full"
                    size="sm"
                  >
                    {isLoading ? (
                      <Loader className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Run All Calibrations
                  </Button>
                  <p className="text-[10px] text-muted-foreground">
                    Calibrates pH, turbidity (clear), and color sensors simultaneously.
                  </p>
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={() => sendCalibrationCommand("cal reset")}
                    disabled={isLoading || isHardwareBusy}
                    variant="destructive"
                    className="w-full"
                    size="sm"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset to Defaults
                  </Button>
                  <p className="text-[10px] text-muted-foreground">
                    Resets all calibration values to factory defaults. Use with caution.
                  </p>
                </div>

                {status && (
                  <div className="mt-4 p-3 rounded bg-secondary/30 border border-border">
                    <p className="text-xs font-medium text-foreground mb-2">Current Calibration State:</p>
                    <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-muted-foreground">
                      <span>pH Offset: {status.phOffset.toFixed(4)}</span>
                      <span>Turb Clear: {status.turbidityClearVoltage.toFixed(3)}V</span>
                      <span>Turb Dirty: {status.turbidityDirtyVoltage.toFixed(3)}V</span>
                      <span>Color Ready: {status.colorBaselineReady ? "Yes" : "No"}</span>
                      <span>Tank Empty: {status.tankEmptyDistanceCm.toFixed(2)}cm</span>
                      <span>Tank Full: {status.tankFullDistanceCm.toFixed(2)}cm</span>
                      <span>Temp Offset: {status.temperatureOffsetC.toFixed(2)}C</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {message && (
          <Alert
            className={cn(
              "mt-4",
              message.type === "success" && "bg-primary/10 border-primary/30",
              message.type === "error" && "bg-destructive/10 border-destructive/30",
              message.type === "info" && "bg-info/10 border-info/30"
            )}
          >
            {message.type === "success" && <CheckCircle2 className="h-4 w-4 text-primary" />}
            {message.type === "error" && <AlertTriangle className="h-4 w-4 text-destructive" />}
            {message.type === "info" && <Info className="h-4 w-4 text-info" />}
            <AlertDescription className={cn(
              "text-xs",
              message.type === "success" && "text-primary",
              message.type === "error" && "text-destructive",
              message.type === "info" && "text-info"
            )}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
