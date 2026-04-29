"use client"

import { useState, useEffect } from "react"
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
}

type SensorReading = {
  hasWater: boolean
  phVoltage: number
  turbidityVoltage: number
  colorR: number
  colorG: number
  colorB: number
  phSensorOk: boolean
  turbiditySensorOk: boolean
  colorSensorOk: boolean
}

interface CalibrationPanelProps {
  sensorReading: SensorReading
}

type CalCommand =
  | "status"
  | "cal ph7"
  | "cal turbidity-clear"
  | "cal turbidity-dirty"
  | "cal color"
  | "cal all"
  | "cal reset"

export function CalibrationPanel({ sensorReading }: CalibrationPanelProps) {
  const [status, setStatus] = useState<CalibrationStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null)
  const [activeTab, setActiveTab] = useState("ph")

  const fetchCalibrationStatus = async () => {
    try {
      const response = await fetch("/api/calibration/status", { cache: "no-store" })
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
      }
    } catch (error) {
      console.error("Failed to fetch calibration status:", error)
    }
  }

  useEffect(() => {
    fetchCalibrationStatus()
  }, [])

  const sendCalibrationCommand = async (command: CalCommand) => {
    setIsLoading(true)
    setMessage(null)

    try {
      const response = await fetch("/api/calibration/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      })

      const result = await response.json()

      if (result.ok) {
        setMessage({ type: "success", text: result.message })
        fetchCalibrationStatus()
      } else {
        setMessage({ type: "error", text: result.message || "Calibration command failed" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to send calibration command" })
    } finally {
      setIsLoading(false)
    }
  }

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
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-4 gap-1">
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
                  disabled={isLoading || getPhStatus().status !== "ok"}
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
                  disabled={isLoading || getTurbidityStatus().status !== "ok"}
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
                  disabled={isLoading || getTurbidityStatus().status !== "ok"}
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
                  disabled={isLoading || getColorStatus().status !== "ok"}
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
                      <li>Ensure water is present in the tank before calibrating</li>
                      <li>Wait for sensor readings to stabilize before calibrating</li>
                      <li>Use known reference solutions for best accuracy</li>
                      <li>Recalibrate periodically for maintained accuracy</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Button
                    onClick={() => sendCalibrationCommand("cal all")}
                    disabled={isLoading || !sensorReading.hasWater}
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
                    disabled={isLoading}
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