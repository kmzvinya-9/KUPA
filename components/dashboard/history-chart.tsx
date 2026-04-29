"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Area,
  Bar,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

interface HistoryChartProps {
  title: string
  data: { date: string; min: number; max: number; avg: number }[]
  color: string
  unit: string
  normalRange?: { low: number; high: number }
}

// Color palettes for different metrics for beautification and classification
const COLOR_PALETTES: Record<string, string[]> = {
  ph: ["#22d3ee", "#06b6d4", "#0891b2", "#0e7490", "#155e75", "#164e63", "#0c4a6e"],
  temperature: ["#f97316", "#ea580c", "#dc2626", "#fb923c", "#fdba74", "#fed7aa", "#ffedd5"],
  turbidity: ["#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95", "#3b0764"],
  flow: ["#34d399", "#10b981", "#059669", "#047857", "#065f46", "#064e3b", "#022c22"],
  default: ["#3b82f6", "#2563eb", "#1d4ed8", "#1e40af", "#1e3a8a", "#172554", "#1e1b4b"],
}

function getColorPalette(title: string): string[] {
  const titleLower = title.toLowerCase()
  if (titleLower.includes("ph")) return COLOR_PALETTES.ph
  if (titleLower.includes("temperature")) return COLOR_PALETTES.temperature
  if (titleLower.includes("turbidity")) return COLOR_PALETTES.turbidity
  if (titleLower.includes("flow")) return COLOR_PALETTES.flow
  return COLOR_PALETTES.default
}

export function HistoryChart({
  title,
  data,
  color,
  unit,
  normalRange,
}: HistoryChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex h-[290px] items-center justify-center text-sm text-muted-foreground">
            No historical data yet. Connect the ESP32 and let it log real readings.
          </div>
        </CardContent>
      </Card>
    )
  }

  const chartData = data.map((d) => ({
    ...d,
    range: d.max - d.min,
    base: d.min,
  }))

  const overallMin = Math.min(...data.map((item) => item.min))
  const overallMax = Math.max(...data.map((item) => item.max))
  const overallAvg = data.reduce((sum, item) => sum + item.avg, 0) / data.length

  const palette = getColorPalette(title)

  return (
    <Card>
      <CardHeader className="space-y-3 pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <span className="text-xs text-muted-foreground">Past 7 Days</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border/60 bg-secondary/30 p-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Lowest</p>
            <p className="font-mono text-sm text-foreground">{overallMin.toFixed(2)}{unit}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/30 p-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Average</p>
            <p className="font-mono text-sm text-foreground">{overallAvg.toFixed(2)}{unit}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/30 p-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Highest</p>
            <p className="font-mono text-sm text-foreground">{overallMax.toFixed(2)}{unit}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        <div className="h-[290px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradient-${title.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                  <stop offset="50%" stopColor={color} stopOpacity={0.6} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.35} />
                </linearGradient>
                <linearGradient id={`gradient-area-${title.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.05} />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}${unit}`}
                width={56}
              />

              {normalRange && (
                <>
                  <ReferenceLine y={normalRange.low} stroke="hsl(var(--warning))" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <ReferenceLine y={normalRange.high} stroke="hsl(var(--warning))" strokeDasharray="3 3" strokeOpacity={0.5} />
                </>
              )}

              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as (typeof chartData)[number]
                  return (
                    <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
                      <p className="mb-2 font-medium text-foreground">{d.date}</p>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>Average: <span className="font-mono text-foreground">{d.avg.toFixed(2)}{unit}</span></p>
                        <p>Min: <span className="font-mono text-foreground">{d.min.toFixed(2)}{unit}</span></p>
                        <p>Max: <span className="font-mono text-foreground">{d.max.toFixed(2)}{unit}</span></p>
                        <p>Range: <span className="font-mono text-foreground">{(d.max - d.min).toFixed(2)}{unit}</span></p>
                      </div>
                    </div>
                  )
                }}
              />

              {/* Area fill for visual depth */}
              <Area
                type="monotone"
                dataKey="avg"
                stroke="none"
                fill={`url(#gradient-area-${title.replace(/\s/g, "")})`}
                isAnimationActive={false}
                baseValue={overallMin - 5}
              />
              <Bar dataKey="base" stackId="range" fill="transparent" isAnimationActive={false} />
              <Bar dataKey="range" stackId="range" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {chartData.map((entry, index) => {
                  const isOutOfRange = normalRange && (entry.avg < normalRange.low || entry.avg > normalRange.high)
                  // Use palette colors for classification with gradient effect
                  const paletteColor = palette[index % palette.length]
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={isOutOfRange ? "hsl(var(--destructive))" : paletteColor}
                      fillOpacity={isOutOfRange ? 0.88 : 0.9}
                      stroke={isOutOfRange ? "hsl(var(--destructive))" : paletteColor}
                      strokeWidth={1}
                    />
                  )
                })}
              </Bar>
              <Line
                type="monotone"
                dataKey="avg"
                stroke={color}
                strokeWidth={2}
                dot={{ r: 3, stroke: "hsl(var(--background))", strokeWidth: 1.5, fill: color }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded" style={{ backgroundColor: color }} />
            <span>Daily range + average line</span>
          </div>
          {normalRange && (
            <div className="flex items-center gap-2">
              <div className="h-px w-4 border-t-2 border-dashed border-warning" />
              <span>Normal range ({normalRange.low}-{normalRange.high}{unit})</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}