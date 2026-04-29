"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Activity, TrendingDown, TrendingUp } from "lucide-react"

interface DataPoint {
  time: string
  value: number
  count?: number
}

interface SensorChartProps {
  title: string
  data: DataPoint[]
  color: string
  unit: string
  minDomain?: number
  maxDomain?: number
  showLiveIndicator?: boolean
  warningThresholds?: { low?: number; high?: number }
}

function formatValue(value: number, unit: string) {
  return `${value.toFixed(2)}${unit ? ` ${unit}` : ""}`
}

export function SensorChart({
  title,
  data,
  color,
  unit,
  minDomain,
  maxDomain,
  showLiveIndicator = true,
  warningThresholds,
}: SensorChartProps) {
  const currentValue = data.length > 0 ? data[data.length - 1].value : null
  const previousValue = data.length > 1 ? data[data.length - 2].value : null
  const minValue = data.length > 0 ? Math.min(...data.map((point) => point.value)) : null
  const maxValue = data.length > 0 ? Math.max(...data.map((point) => point.value)) : null
  const avgValue = data.length > 0 ? data.reduce((sum, point) => sum + point.value, 0) / data.length : null
  const delta = currentValue !== null && previousValue !== null ? currentValue - previousValue : null
  const direction = delta === null || Math.abs(delta) < 0.0001 ? "flat" : delta > 0 ? "up" : "down"

  return (
    <Card>
      <CardHeader className="space-y-3 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {title}
            </CardTitle>
            <div className="mt-2 flex items-center gap-2">
              {currentValue !== null ? (
                <span className="font-mono text-2xl font-semibold" style={{ color }}>
                  {formatValue(currentValue, unit)}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">No live values yet</span>
              )}
              {delta !== null && direction !== "flat" && (
                <Badge variant="outline" className="gap-1 text-xs">
                  {direction === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(delta).toFixed(2)}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {showLiveIndicator && (
              <Badge variant="outline" className="gap-1 border-primary/50 text-xs text-primary">
                <Activity className="h-3 w-3 animate-pulse" />
                Live
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              Brush zoom
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-border/60 bg-secondary/30 p-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Min</p>
            <p className="font-mono text-sm text-foreground">{minValue === null ? "--" : formatValue(minValue, unit)}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/30 p-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Average</p>
            <p className="font-mono text-sm text-foreground">{avgValue === null ? "--" : formatValue(avgValue, unit)}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/30 p-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Max</p>
            <p className="font-mono text-sm text-foreground">{maxValue === null ? "--" : formatValue(maxValue, unit)}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/30 p-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Samples</p>
            <p className="font-mono text-sm text-foreground">{data.length}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        <div className="h-[280px]">
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Waiting for real ESP32 data...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 12 }}>
                <defs>
                  <linearGradient id={`gradient-${title.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                    <stop offset="50%" stopColor={color} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id={`gradient-glow-${title.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.1} />
                  </linearGradient>
                </defs>

                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.35} strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  tickMargin={8}
                  minTickGap={24}
                  interval="preserveStartEnd"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  tickMargin={8}
                  domain={[minDomain ?? "auto", maxDomain ?? "auto"]}
                  width={44}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const point = payload[0].payload as DataPoint
                    return (
                      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
                        <p className="mb-2 text-xs font-medium text-foreground">{label}</p>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>
                            Value: <span className="font-mono text-foreground">{formatValue(point.value, unit)}</span>
                          </p>
                          {avgValue !== null && (
                            <p>
                              24h avg: <span className="font-mono text-foreground">{formatValue(avgValue, unit)}</span>
                            </p>
                          )}
                          <p>
                            Bucket samples: <span className="font-mono text-foreground">{point.count ?? 1}</span>
                          </p>
                        </div>
                      </div>
                    )
                  }}
                />

                {avgValue !== null && (
                  <ReferenceLine
                    y={Number(avgValue.toFixed(2))}
                    stroke={color}
                    strokeOpacity={0.45}
                    strokeDasharray="5 5"
                    strokeWidth={1.25}
                  />
                )}
                {warningThresholds?.low !== undefined && (
                  <ReferenceLine y={warningThresholds.low} stroke="hsl(var(--warning))" strokeDasharray="5 5" strokeWidth={1} />
                )}
                {warningThresholds?.high !== undefined && (
                  <ReferenceLine y={warningThresholds.high} stroke="hsl(var(--warning))" strokeDasharray="5 5" strokeWidth={1} />
                )}

                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="none"
                  fill={`url(#gradient-${title.replace(/\s/g, "")})`}
                  strokeWidth={1.5}
                  stroke={color + "60"}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2.2}
                  dot={false}
                  isAnimationActive={false}
                  activeDot={{ r: 4, fill: color, stroke: "hsl(var(--background))", strokeWidth: 2 }}
                />
                <Brush
                  dataKey="time"
                  height={22}
                  travellerWidth={8}
                  stroke={color}
                  fill="hsl(var(--secondary))"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
