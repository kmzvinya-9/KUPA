"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface SensorCardProps {
  title: string
  value: string | number
  unit: string
  icon: LucideIcon
  status?: "normal" | "warning" | "critical" | "offline"
  subtitle?: string
}

export function SensorCard({
  title,
  value,
  unit,
  icon: Icon,
  status = "normal",
  subtitle,
}: SensorCardProps) {
  const statusColors = {
    normal: "text-primary",
    warning: "text-warning",
    critical: "text-destructive",
    offline: "text-muted-foreground",
  }

  const statusBg = {
    normal: "bg-primary/10",
    warning: "bg-warning/10",
    critical: "bg-destructive/10",
    offline: "bg-muted/50",
  }

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={cn("rounded-md p-2", statusBg[status])}>
          <Icon className={cn("h-4 w-4", statusColors[status])} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1">
          <span className={cn("text-3xl font-bold tracking-tight", statusColors[status])}>
            {value}
          </span>
          <span className="text-sm text-muted-foreground">{unit}</span>
        </div>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
      {status !== "offline" && (
        <div className={cn("absolute bottom-0 left-0 h-1 w-full", statusBg[status])} />
      )}
    </Card>
  )
}
