"use client"

import { cn } from "@/lib/utils"
import { BatteryFull, BatteryLow, BatteryMedium, BatteryWarning, Zap, Plug } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface BatteryIndicatorProps {
  level: number // 0-100
  isCharging?: boolean
  voltage?: number
  mainsMode?: boolean // New prop for mains power mode
}

export function BatteryIndicator({ level, isCharging = false, voltage, mainsMode = false }: BatteryIndicatorProps) {
  // In mains mode, we just show connected/disconnected status
  if (mainsMode) {
    const v = voltage ?? 0
    const isConnected = level > 0 || v > 1.0
    const displayVoltage = v > 0 ? v.toFixed(2) : "0.00"

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex h-6 w-10 items-center justify-center rounded-sm border-2 border-current transition-colors",
                isConnected ? "text-primary bg-primary/10" : "text-destructive bg-destructive/10"
              )}>
                {isConnected ? (
                  <Plug className="h-4 w-4 text-primary" />
                ) : (
                  <BatteryWarning className="h-4 w-4 text-destructive" />
                )}
              </div>
              <span className={cn(
                "text-sm font-medium",
                isConnected ? "text-primary" : "text-destructive"
              )}>
                {isConnected ? "Connected" : "Disconnected"}
              </span>
              {isConnected && (
                <Zap className="h-3 w-3 fill-warning text-warning animate-pulse" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium">
                {isConnected ? "Mains Power Connected" : "Mains Power Disconnected"}
              </p>
              <p className="text-xs text-muted-foreground">
                Voltage: {displayVoltage}V
              </p>
              <p className="text-xs text-muted-foreground">
                Mode: Mains Power Supply
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Original battery percentage mode
  const getStatus = () => {
    if (level <= 10) return "critical"
    if (level <= 25) return "low"
    if (level <= 50) return "medium"
    return "full"
  }

  const status = getStatus()

  const statusConfig = {
    critical: {
      icon: BatteryWarning,
      color: "text-destructive",
      bgColor: "bg-destructive",
      label: "Critical - Charge Now",
    },
    low: {
      icon: BatteryLow,
      color: "text-warning",
      bgColor: "bg-warning",
      label: "Low Battery",
    },
    medium: {
      icon: BatteryMedium,
      color: "text-chart-3",
      bgColor: "bg-chart-3",
      label: "Battery OK",
    },
    full: {
      icon: BatteryFull,
      color: "text-primary",
      bgColor: "bg-primary",
      label: "Battery Good",
    },
  }

  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            {/* Battery Icon with fill visualization */}
            <div className="relative">
              <div className="relative flex h-6 w-10 items-center rounded-sm border-2 border-current">
                {/* Battery fill */}
                <div
                  className={cn(
                    "absolute left-0.5 top-0.5 bottom-0.5 rounded-xs transition-all duration-500",
                    config.bgColor,
                    status === "critical" && "animate-pulse",
                    `w-[${Math.max(5, level * 0.85)}%]`
                  )}
                />
                {/* Battery tip */}
                <div className="absolute -right-1 top-1/2 h-2 w-1 -translate-y-1/2 rounded-r-sm bg-current" />
              </div>
              {/* Charging indicator */}
              {isCharging && (
                <Zap className="absolute -right-1 -top-1 h-3 w-3 fill-warning text-warning" />
              )}
            </div>
            
            {/* Percentage */}
            <span className={cn("text-sm font-medium", config.color)}>
              {level}%
            </span>
            
            {/* Warning pulse for critical */}
            {status === "critical" && !isCharging && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">{config.label}</p>
            {voltage && (
              <p className="text-xs text-muted-foreground">
                Voltage: {voltage.toFixed(2)}V
              </p>
            )}
            {isCharging && (
              <p className="text-xs text-warning">Charging...</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}