"use client"

import { useEffect, useMemo, useState, type ChangeEvent } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Download,
  Info,
  Mail,
  XCircle,
} from "lucide-react"

export type AlertSeverity = "critical" | "warning" | "info" | "success"

export interface Alert {
  id: string
  severity: AlertSeverity
  title: string
  message: string
  timestamp: Date
  source: string
}

interface AlertPanelProps {
  alerts: Alert[]
}

type ReportRequestState = {
  type: "idle" | "success" | "warning" | "error"
  message: string
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function getTodayDateString() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export function AlertPanel({ alerts }: AlertPanelProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [todayDateString, setTodayDateString] = useState("")
  const [reportDate, setReportDate] = useState("")
  const [reportEmail, setReportEmail] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [requestState, setRequestState] = useState<ReportRequestState>({
    type: "idle",
    message: "",
  })

  const activeAlerts = alerts
  const criticalCount = activeAlerts.filter((a) => a.severity === "critical").length
  const warningCount = activeAlerts.filter((a) => a.severity === "warning").length
  const reportDownloadUrl = useMemo(() => `/api/system-alerts/report?date=${encodeURIComponent(reportDate)}`, [reportDate])

  useEffect(() => {
    const today = getTodayDateString()
    setIsMounted(true)
    setTodayDateString(today)
    setReportDate((current) => current || today)
  }, [])

  const severityConfig = {
    critical: {
      icon: XCircle,
      bgColor: "bg-destructive/10",
      borderColor: "border-destructive/50",
      textColor: "text-destructive",
    },
    warning: {
      icon: AlertTriangle,
      bgColor: "bg-warning/10",
      borderColor: "border-warning/50",
      textColor: "text-warning",
    },
    info: {
      icon: Info,
      bgColor: "bg-accent/10",
      borderColor: "border-accent/50",
      textColor: "text-accent",
    },
    success: {
      icon: CheckCircle2,
      bgColor: "bg-primary/10",
      borderColor: "border-primary/50",
      textColor: "text-primary",
    },
  }

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date)
  }

  const handleEmailReport = async () => {
    const normalizedEmail = reportEmail.trim()

    if (!reportDate) {
      setRequestState({ type: "error", message: "Select a date before sending the graph report." })
      return
    }

    if (!isValidEmail(normalizedEmail)) {
      setRequestState({ type: "error", message: "Enter a valid email address such as cvas@gmail.com." })
      return
    }

    setIsSending(true)
    setRequestState({ type: "idle", message: "" })

    try {
      const response = await fetch("/api/system-alerts/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: reportDate, email: normalizedEmail }),
      })

      const payload = (await response.json()) as {
        ok: boolean
        emailed?: boolean
        queued?: boolean
        emailConfigured?: boolean
        message?: string
        downloadUrl?: string
      }

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "Unable to prepare the graph report email.")
      }

      if (payload.emailed) {
        setRequestState({
          type: "success",
          message: payload.message || `Graph report sent to ${normalizedEmail}.`,
        })
        return
      }

      setRequestState({
        type: payload.emailConfigured ? "success" : "warning",
        message:
          payload.message ||
          "The report is ready, but automatic graph email delivery still needs the server SMTP settings to be configured.",
      })
    } catch (error) {
      setRequestState({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to send the graph report.",
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Bell className="h-4 w-4" />
              System Alerts
              {activeAlerts.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeAlerts.length}
                </Badge>
              )}
            </CardTitle>
            {(criticalCount > 0 || warningCount > 0) && (
              <div className="flex gap-2 pt-3">
                {criticalCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    {criticalCount} Critical
                  </Badge>
                )}
                {warningCount > 0 && (
                  <Badge variant="outline" className="gap-1 border-warning text-warning">
                    <AlertTriangle className="h-3 w-3" />
                    {warningCount} Warning
                  </Badge>
                )}
              </div>
            )}
          </div>

          <div className="w-full max-w-xl rounded-lg border border-border bg-secondary/20 p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <Mail className="h-4 w-4" />
              Daily graph report
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
              <div className="space-y-1">
                <label htmlFor="report-date" className="text-xs text-muted-foreground">
                  Selected date
                </label>
                <Input
                  id="report-date"
                  type="date"
                  value={reportDate}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setReportDate(event.target.value)}
                  max={todayDateString || undefined}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="report-email" className="text-xs text-muted-foreground">
                  Email address
                </label>
                <Input
                  id="report-email"
                  type="email"
                  value={reportEmail}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setReportEmail(event.target.value)}
                  placeholder="cvas@gmail.com"
                />
              </div>
              <Button asChild variant="outline" className="w-full md:w-auto">
                <a href={reportDownloadUrl} target="_blank" rel="noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  PDF
                </a>
              </Button>
              <Button onClick={handleEmailReport} disabled={isSending} className="w-full md:w-auto">
                <Mail className="mr-2 h-4 w-4" />
                {isSending ? "Sending..." : "Email graphs"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Emails include inline graphs, and the PDF download contains the same chart set.
            </p>
            {requestState.type !== "idle" && (
              <div
                className={cn(
                  "mt-3 rounded-md border px-3 py-2 text-xs",
                  requestState.type === "success" && "border-primary/40 bg-primary/10 text-primary",
                  requestState.type === "warning" && "border-warning/40 bg-warning/10 text-warning",
                  requestState.type === "error" && "border-destructive/40 bg-destructive/10 text-destructive",
                )}
              >
                {requestState.message}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="max-h-80 space-y-2 overflow-y-auto">
        {activeAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="mb-2 h-8 w-8 text-primary" />
            <p className="text-sm font-medium text-foreground">All Systems Normal</p>
            <p className="text-xs text-muted-foreground">No active alerts</p>
          </div>
        ) : (
          activeAlerts.map((alert) => {
            const config = severityConfig[alert.severity]
            const Icon = config.icon
            return (
              <div
                key={alert.id}
                className={cn(
                  "rounded-lg border p-3 transition-all",
                  config.bgColor,
                  config.borderColor,
                  alert.severity === "critical" && "animate-pulse",
                )}
              >
                <div className="flex items-start gap-3">
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config.textColor)} />
                  <div className="flex-1 space-y-1">
                    <p className={cn("text-sm font-medium", config.textColor)}>{alert.title}</p>
                    <p className="text-xs text-muted-foreground">{alert.message}</p>
                    <div className="flex items-center gap-2 pt-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {alert.source}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{isMounted ? formatTime(alert.timestamp) : "--:--:--"}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
