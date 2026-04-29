"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Palette } from "lucide-react"

interface ColorSensorGaugeProps {
  r: number
  g: number
  b: number
  clearValue?: number
  lux?: number
}

export function ColorSensorGauge({
  r,
  g,
  b,
  clearValue = 255,
  lux = 500,
}: ColorSensorGaugeProps) {
  // Normalize RGB values to 0-255 range for display
  const normalizedR = Math.min(255, Math.max(0, r))
  const normalizedG = Math.min(255, Math.max(0, g))
  const normalizedB = Math.min(255, Math.max(0, b))
  
  // Calculate color temperature approximation (simplified)
  const getColorTemperature = () => {
    const total = r + g + b
    if (total === 0) return "Unknown"
    const ratio = b / Math.max(r, 1)
    if (ratio > 1.5) return "Cool (>6500K)"
    if (ratio > 1.0) return "Neutral (~5000K)"
    if (ratio > 0.6) return "Warm (~3000K)"
    return "Very Warm (<2700K)"
  }
  
  // Get screening hint based on optical color
  const getWaterQualityHint = () => {
    const brightness = (r + g + b) / 3
    if (brightness > 240) return { label: "Clear", status: "good" }
    if (brightness > 200) return { label: "Slight Shift", status: "normal" }
    if (brightness > 150) return { label: "Turbid", status: "warning" }
    return { label: "Strong Shift", status: "critical" }
  }
  
  const quality = getWaterQualityHint()

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Palette className="h-4 w-4" />
          Color Sensor (TCS3200 / TCS230)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-6">
          {/* Color Display */}
          <div className="flex flex-col items-center gap-3">
            {/* Main color swatch */}
            <div
              className="h-24 w-24 rounded-xl border-2 border-border shadow-inner"
              style={{
                backgroundColor: `rgb(${normalizedR}, ${normalizedG}, ${normalizedB})`,
                boxShadow: `inset 0 2px 10px rgba(0,0,0,0.2), 0 0 20px rgba(${normalizedR}, ${normalizedG}, ${normalizedB}, 0.3)`,
              }}
            />
            
            {/* Hex value */}
            <div className="rounded bg-secondary/50 px-3 py-1">
              <span className="font-mono text-sm text-foreground">
                #{normalizedR.toString(16).padStart(2, "0")}
                {normalizedG.toString(16).padStart(2, "0")}
                {normalizedB.toString(16).padStart(2, "0")}
              </span>
            </div>
          </div>

          {/* RGB Bars and Stats */}
          <div className="flex-1 space-y-4">
            {/* RGB Channel Bars */}
            <div className="space-y-2">
              {/* Red Channel */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-red-400">Red</span>
                  <span className="font-mono text-foreground">{normalizedR}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300"
                    style={{ width: `${(normalizedR / 255) * 100}%` }}
                  />
                </div>
              </div>

              {/* Green Channel */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-green-400">Green</span>
                  <span className="font-mono text-foreground">{normalizedG}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-300"
                    style={{ width: `${(normalizedG / 255) * 100}%` }}
                  />
                </div>
              </div>

              {/* Blue Channel */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-blue-400">Blue</span>
                  <span className="font-mono text-foreground">{normalizedB}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-300"
                    style={{ width: `${(normalizedB / 255) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded bg-secondary/50 p-2">
                <p className="text-xs text-muted-foreground">Clear Channel</p>
                <p className="font-mono text-sm text-foreground">{clearValue}</p>
              </div>
              <div className="rounded bg-secondary/50 p-2">
                <p className="text-xs text-muted-foreground">Lux</p>
                <p className="font-mono text-sm text-foreground">{lux}</p>
              </div>
            </div>

            <div className="rounded border border-border bg-secondary/20 p-2">
              <p className="text-xs text-muted-foreground">
                Optical channels are normalized against the transparent container baseline, so stable clear-tin readings should stay near full-scale.
              </p>
            </div>

            {/* Color Temperature & Quality */}
            <div className="flex items-center justify-between rounded border border-border bg-secondary/30 p-2">
              <div>
                <p className="text-xs text-muted-foreground">Color Temp</p>
                <p className="text-xs font-medium text-foreground">{getColorTemperature()}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Water Quality</p>
                <p className={cn(
                  "text-xs font-medium",
                  quality.status === "good" && "text-primary",
                  quality.status === "normal" && "text-accent",
                  quality.status === "warning" && "text-warning",
                  quality.status === "critical" && "text-destructive"
                )}>
                  {quality.label}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
