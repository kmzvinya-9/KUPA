"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Eye } from "lucide-react"

interface TurbidityGaugeProps {
  value: number
  hasWater?: boolean
  isConnected?: boolean
  ntuValue?: number
}

export function TurbidityGauge({ value, hasWater = true, isConnected = true, ntuValue }: TurbidityGaugeProps) {
  // When there's no water or ESP32 is offline, show "No water" status
  const getStatus = () => {
    if (!isConnected || !hasWater) return "no_water"
    if (value >= 80) return "strong"
    if (value >= 60) return "usable"
    if (value >= 35) return "weak"
    return "critical"
  }

  const status = getStatus()

  const statusConfig = {
    strong: { label: "Low turbidity", color: "text-primary", bgColor: "bg-primary" },
    usable: { label: "Moderate turbidity", color: "text-accent", bgColor: "bg-accent" },
    weak: { label: "Elevated turbidity", color: "text-warning", bgColor: "bg-warning" },
    critical: { label: "Very high turbidity", color: "text-destructive", bgColor: "bg-destructive" },
    no_water: { label: "No water", color: "text-muted-foreground", bgColor: "bg-muted" },
  }

  const config = statusConfig[status]

  const segmentBgClass = (!isConnected || !hasWater) ? "bg-muted/80" : "bg-muted/30"

  const opacityIndex = Math.min(10, Math.max(0, Math.round(value / 10)))
  const overlayOpacity = (!isConnected || !hasWater) ? 0 : opacityIndex / 10
  const markerLeftPosition = (opacityIndex / 10) * 100

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Eye className="h-4 w-4" />
          Turbidity
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="relative h-32 w-24 overflow-hidden rounded-b-xl border-2 border-t-0 border-border bg-secondary/20">
            <div className="absolute inset-0 flex flex-col">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={cn("flex-1 transition-all duration-500", segmentBgClass)}
                />
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className={cn("h-full w-4 bg-gradient-to-b from-foreground/20 via-foreground/10 to-transparent transition-opacity duration-500", `opacity-${opacityIndex * 10}`)}
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-foreground drop-shadow-lg">
                {(!isConnected || !hasWater) ? "--" : value.toFixed(0)}%
              </span>
            </div>
            <div className="absolute right-1 top-0 flex h-full flex-col justify-between py-2 text-[8px] text-muted-foreground">
              <span>100</span>
              <span>50</span>
              <span>0</span>
            </div>
          </div>
          <div className="absolute -top-1 left-0 right-0 h-2 rounded-t border-2 border-b-0 border-border bg-card" />
          <div className="absolute -right-2 -top-1 h-3 w-4 rounded-tr-lg border-2 border-b-0 border-l-0 border-border" />
        </div>

        <div className="text-center">
          <p className={cn("text-lg font-semibold", config.color)}>{config.label}</p>
          {!isConnected ? (
            <p className="text-sm text-muted-foreground">ESP32 is offline - turbidity reading unavailable</p>
          ) : !hasWater ? (
            <p className="text-sm text-muted-foreground">No water detected - turbidity measurement paused</p>
          ) : (
            <p className="text-sm text-muted-foreground">Held at zero when there is no water</p>
          )}
          {ntuValue !== undefined && hasWater && isConnected && (
            <p className="text-xs text-muted-foreground">Approximate clarity-derived NTU estimate: {ntuValue.toFixed(1)}</p>
          )}
        </div>

        {isConnected && hasWater && (
          <div className="w-full space-y-1">
            <div className="relative h-3 overflow-hidden rounded-full bg-gradient-to-r from-muted-foreground via-warning via-60% via-accent via-80% to-primary">
              <div
                className={cn("turbidity-marker", `left-[${markerLeftPosition}%]`)}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>High turbidity</span>
              <span>Low turbidity</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}