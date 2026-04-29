"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Thermometer } from "lucide-react"

interface ThermometerGaugeProps {
  value: number
  min?: number
  max?: number
  unit?: string
  warningLow?: number
  warningHigh?: number
}

export function ThermometerGauge({
  value,
  min = 0,
  max = 50,
  unit = "°C",
  warningLow = 15,
  warningHigh = 30,
}: ThermometerGaugeProps) {
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))

  const getStatus = () => {
    if (value < warningLow || value > warningHigh) return "warning"
    return "normal"
  }

  const status = getStatus()

  const fillColor = status === "warning" ? "bg-warning" : "bg-destructive"
  const textColor = status === "warning" ? "text-warning" : "text-foreground"

  // Temperature scale markers
  const markers = [max, Math.round((max + min) / 2), min]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Thermometer className="h-4 w-4" />
          Temperature
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="flex items-end gap-4">
          {/* Thermometer visualization */}
          <div className="relative flex flex-col items-center">
            {/* Tube */}
            <div className="relative h-40 w-6 rounded-t-full border-2 border-border bg-secondary/30">
              {/* Mercury fill */}
              <div
                className={cn(
                  "absolute bottom-0 left-0.5 right-0.5 rounded-t-full transition-all duration-1000",
                  fillColor
                )}
                style={{ height: `${percentage}%` }}
              />
              {/* Scale lines */}
              <div className="absolute -right-4 top-0 flex h-full flex-col justify-between py-1">
                {markers.map((mark, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div className="h-px w-2 bg-border" />
                    <span className="text-[10px] text-muted-foreground">{mark}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Bulb */}
            <div
              className={cn(
                "relative -mt-1 flex h-10 w-10 items-center justify-center rounded-full border-2 border-border",
                fillColor
              )}
            >
              <span className="text-[10px] font-bold text-primary-foreground">{unit}</span>
            </div>
          </div>

          {/* Value display */}
          <div className="pb-4">
            <span className={cn("text-4xl font-bold", textColor)}>{value.toFixed(1)}</span>
            <span className="ml-1 text-lg text-muted-foreground">{unit}</span>
            <p className="mt-1 text-xs text-muted-foreground">
              {status === "warning" ? "Outside normal range" : "Normal range"}
            </p>
          </div>
        </div>

        {/* Range indicator */}
        <div className="w-full space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Cold</span>
            <span>Optimal ({warningLow}-{warningHigh}{unit})</span>
            <span>Hot</span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-gradient-to-r from-accent via-primary to-destructive">
            <div
              className="absolute top-0 h-full w-1 -translate-x-1/2 bg-foreground shadow-lg"
              style={{ left: `${percentage}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
