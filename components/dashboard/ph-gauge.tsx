"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Beaker } from "lucide-react"

interface PhGaugeProps {
  value: number
  classification: string
  substance: string
}

export function PhGauge({ value, classification, substance }: PhGaugeProps) {
  const getPhColor = (ph: number) => {
    if (ph < 2.5) return "bg-destructive"
    if (ph < 4.5) return "bg-chart-3"
    if (ph < 6.5) return "bg-accent"
    if (ph < 8.5) return "bg-primary"
    if (ph < 11.5) return "bg-chart-5"
    return "bg-destructive"
  }

  const getPhTextColor = (ph: number) => {
    if (ph < 2.5) return "text-destructive"
    if (ph < 4.5) return "text-chart-3"
    if (ph < 6.5) return "text-accent"
    if (ph < 8.5) return "text-primary"
    if (ph < 11.5) return "text-chart-5"
    return "text-destructive"
  }

  const phPosition = Math.min(100, Math.max(0, (value / 14) * 100))

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Beaker className="h-4 w-4" />
          pH Level
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center">
          <div className="relative">
            <span className={cn("text-5xl font-bold", getPhTextColor(value))}>
              {value.toFixed(1)}
            </span>
            <span className="ml-1 text-lg text-muted-foreground">pH</span>
          </div>
        </div>

        {/* pH Scale Bar */}
        <div className="space-y-2">
          <div className="relative h-4 overflow-hidden rounded-full bg-gradient-to-r from-destructive via-chart-3 via-30% via-accent via-50% via-primary via-60% via-chart-5 via-80% to-destructive">
            <div
              className="absolute top-0 h-full w-1 -translate-x-1/2 bg-foreground shadow-lg"
              style={{ left: `${phPosition}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0</span>
            <span>7</span>
            <span>14</span>
          </div>
        </div>

        {/* Classification */}
        <div className="rounded-lg border border-border bg-secondary/30 p-3">
          <p className="text-xs text-muted-foreground">Classification</p>
          <p className={cn("font-semibold", getPhTextColor(value))}>
            {classification}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Likely Substance</p>
          <p className="text-sm text-foreground">{substance}</p>
        </div>
      </CardContent>
    </Card>
  )
}
