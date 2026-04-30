"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Waves } from "lucide-react"

interface TankLevelProps {
  level: number
  capacity: number
  status: "full" | "normal" | "low" | "empty"
}

export function TankLevel({ level, capacity, status }: TankLevelProps) {
  const percentage = Math.min(100, Math.max(0, level))
  const estimatedVolume = (capacity * percentage) / 100

  const statusLabels = {
    full: "Tank Full",
    normal: "Normal Level",
    low: "Low Level",
    empty: "Tank Empty",
  }

  const statusColors = {
    full: "text-primary",
    normal: "text-primary",
    low: "text-warning",
    empty: "text-destructive",
  }

  const fillColors = {
    full: "bg-primary",
    normal: "bg-primary",
    low: "bg-warning",
    empty: "bg-destructive",
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Waves className="h-4 w-4" />
          Tank Level
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="relative h-48 w-24 overflow-hidden rounded-lg border-2 border-border bg-secondary/30">
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 transition-all duration-1000",
              fillColors[status]
            )}
            style={{ height: `${percentage}%` }}
          >
            <div className="absolute inset-0 opacity-30">
              <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M0,50 Q25,30 50,50 T100,50 V100 H0 Z" className="animate-pulse fill-current" />
              </svg>
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-foreground drop-shadow-lg">{percentage.toFixed(0)}%</span>
          </div>
          <div className="absolute right-1 top-0 flex h-full flex-col justify-between py-2 text-[10px] text-muted-foreground">
            <span>100</span>
            <span>75</span>
            <span>50</span>
            <span>25</span>
            <span>0</span>
          </div>
        </div>
        <div className="text-center">
          <p className={cn("text-lg font-semibold", statusColors[status])}>{statusLabels[status]}</p>
          <p className="text-sm text-muted-foreground">{estimatedVolume.toFixed(1)}L estimated of {capacity.toFixed(0)}L tank</p>
        </div>
      </CardContent>
    </Card>
  )
}
