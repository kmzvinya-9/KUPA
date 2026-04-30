"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { FlaskConical, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react"

interface ChemicalRegistryProps {
  currentPh: number
  turbidityPercent: number
  lux: number
  isConnected: boolean
  hasWater: boolean
  screeningScore: number
  screeningStatus: "low" | "moderate" | "high"
  screeningSummary: string
}

type ScreeningCheck = {
  label: string
  hint: string
  evaluate: (ph: number, turbidityPercent: number, lux: number) => "pass" | "warn" | "idle"
}

const screeningChecks: ScreeningCheck[] = [
  {
    label: "pH stability band",
    hint: "Potable screening target: 6.5 - 8.5 pH",
    evaluate: (ph: number) => (ph >= 6.5 && ph <= 8.5 ? "pass" : ph > 0 ? "warn" : "idle"),
  },
  {
    label: "Turbidity band",
    hint: "Higher turbidity can indicate suspended solids or contamination",
    evaluate: (_ph: number, turbidityPercent: number) => (turbidityPercent >= 60 ? "pass" : turbidityPercent > 0 ? "warn" : "idle"),
  },
  {
    label: "Color / lux consistency",
    hint: "Abrupt color or brightness shifts can flag residue screening anomalies",
    evaluate: (_ph: number, _turbidityPercent: number, lux: number) => (lux >= 40 ? "pass" : lux > 0 ? "warn" : "idle"),
  },
]

export function ChemicalRegistry({
  currentPh,
  turbidityPercent,
  lux,
  isConnected,
  hasWater,
  screeningScore,
  screeningStatus,
  screeningSummary,
}: ChemicalRegistryProps) {
  const headerTone = {
    low: "border-primary/50 bg-primary/10 text-primary",
    moderate: "border-warning/50 bg-warning/10 text-warning",
    high: "border-destructive/50 bg-destructive/10 text-destructive",
  }

  const HeaderIcon = screeningStatus === "high" ? ShieldAlert : screeningStatus === "moderate" ? ShieldQuestion : ShieldCheck

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <FlaskConical className="h-4 w-4" />
          Drug / Chemical Residue Screening
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected && (
          <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 text-sm text-muted-foreground">
            ESP32 offline. Live charts hide readings until telemetry resumes, then the dashboard backfills stored records from the ESP32 and SD card.
          </div>
        )}

        {isConnected && !hasWater && (
          <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 text-sm text-muted-foreground">
            No water detected. Residue screening is paused until the tank has water.
          </div>
        )}

        <div className={cn("rounded-xl border p-4", headerTone[screeningStatus])}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide">Screening score</p>
              <p className="mt-1 text-2xl font-semibold">{screeningScore}/100</p>
              <p className="mt-2 text-sm">{screeningSummary}</p>
            </div>
            <HeaderIcon className="mt-1 h-5 w-5" />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {screeningChecks.map((check) => {
            const result = check.evaluate(currentPh, turbidityPercent, lux)
            const resultLabel = result === "pass" ? "Within screen" : result === "warn" ? "Needs review" : "Waiting"
            const resultTone = result === "pass"
              ? "border-primary/50 bg-primary/10 text-primary"
              : result === "warn"
                ? "border-warning/50 bg-warning/10 text-warning"
                : "border-border/60 bg-secondary/10 text-muted-foreground"

            return (
              <div key={check.label} className={cn("rounded-lg border p-3", resultTone)}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{check.label}</p>
                  <Badge variant="outline" className="border-current/40 text-current">{resultLabel}</Badge>
                </div>
                <p className="mt-2 text-xs">{check.hint}</p>
              </div>
            )
          })}
        </div>

        <div className="rounded-lg border border-border/60 bg-secondary/10 p-3 text-xs text-muted-foreground">
          This system is useful for screening changes in water chemistry and optical behavior. It does not identify specific drugs or chemical residues by itself; confirmation still requires targeted sensors or lab analysis.
        </div>
      </CardContent>
    </Card>
  )
}
