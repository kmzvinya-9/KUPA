"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Cpu,
  HardDrive,
  Save,
} from "lucide-react"

interface SystemStatusProps {
  mode: "active" | "calibrating" | "static" | "error"
  flowDetected: boolean
  calibrationStatus: "complete" | "in_progress" | "needed"
  errors: string[]
  uptime: string
  sdCardActive?: boolean
  sdCardWriting?: boolean
  sdCardUsage?: number
  pendingQueueCount?: number
}

export function SystemStatus({
  mode,
  flowDetected,
  calibrationStatus,
  errors,
  uptime,
  sdCardActive = true,
  sdCardWriting = false,
  sdCardUsage = 45,
  pendingQueueCount = 0,
}: SystemStatusProps) {
  const modeLabels = {
    active: "Active Monitoring",
    calibrating: "Auto-Calibrating",
    static: "Static Mode",
    error: "Error State",
  }

  const modeColors = {
    active: "bg-primary text-primary-foreground",
    calibrating: "bg-warning text-warning-foreground",
    static: "bg-accent text-accent-foreground",
    error: "bg-destructive text-destructive-foreground",
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Cpu className="h-4 w-4" />
          System Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Operating Mode</span>
          <Badge className={cn("font-medium", modeColors[mode])}>
            {modeLabels[mode]}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Flow Detection</span>
          <div className="flex items-center gap-2">
            {flowDetected ? (
              <>
                <Activity className="h-4 w-4 animate-pulse text-primary" />
                <span className="text-sm text-primary">Flowing</span>
              </>
            ) : (
              <>
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">No Flow</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Calibration</span>
          <div className="flex items-center gap-2">
            {calibrationStatus === "complete" && (
              <>
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="text-sm text-primary">Complete</span>
              </>
            )}
            {calibrationStatus === "in_progress" && (
              <>
                <Activity className="h-4 w-4 animate-spin text-warning" />
                <span className="text-sm text-warning">In Progress</span>
              </>
            )}
            {calibrationStatus === "needed" && (
              <>
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-sm text-warning">Needed</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Uptime</span>
          <span className="text-sm font-mono text-foreground">{uptime}</span>
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className={cn(
                "h-4 w-4",
                sdCardActive ? "text-primary" : "text-destructive"
              )} />
              <span className="text-sm font-medium text-foreground">SD Card</span>
            </div>
            <div className="flex items-center gap-2">
              {sdCardWriting && <Save className="h-3 w-3 animate-pulse text-warning" />}
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  sdCardActive
                    ? "border-primary/50 text-primary"
                    : "border-destructive/50 text-destructive"
                )}
              >
                {sdCardActive ? "Active" : "Not Detected"}
              </Badge>
            </div>
          </div>

          {sdCardActive && (
            <>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Storage Used</span>
                <span className="font-mono text-foreground">{sdCardUsage}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Pending Uploads</span>
                <span className="font-mono text-foreground">{pendingQueueCount}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    sdCardUsage > 90 ? "bg-destructive" :
                    sdCardUsage > 70 ? "bg-warning" : "bg-primary"
                  )}
                  style={{ width: `${sdCardUsage}%` }}
                />
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {sdCardWriting ? (
                  <>
                    <Save className="h-3 w-3 animate-pulse text-warning" />
                    <span>Writing live data...</span>
                  </>
                ) : pendingQueueCount > 0 ? (
                  <>
                    <Activity className="h-3 w-3 animate-pulse text-warning" />
                    <span>Uploading stored data first</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-primary" />
                    <span>Ready for live logging</span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {errors.length > 0 && (
          <div className="space-y-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">Active Errors</span>
            </div>
            {errors.map((error, i) => (
              <p key={i} className="text-xs text-destructive">{error}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
