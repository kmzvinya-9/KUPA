"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

interface ComparisonPoint {
  time: string
  ph: number
  temperatureC: number
  turbidityPercent: number
  flowRateLMin: number
  phNormalized: number
  temperatureNormalized: number
  turbidityNormalized: number
  flowNormalized: number
}

interface MultiMetricChartProps {
  data: ComparisonPoint[]
}

const METRICS = [
  { key: "phNormalized", rawKey: "ph", label: "pH", color: "#22d3ee", unit: "pH" },
  { key: "temperatureNormalized", rawKey: "temperatureC", label: "Temperature", color: "#f97316", unit: "°C" },
  { key: "turbidityNormalized", rawKey: "turbidityPercent", label: "Turbidity", color: "#a78bfa", unit: "%" },
  { key: "flowNormalized", rawKey: "flowRateLMin", label: "Flow", color: "#34d399", unit: "L/min" },
] as const

export function MultiMetricChart({ data }: MultiMetricChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              24h Multi-Sensor Comparison
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Each sensor is normalized to a 0-100 trend scale so you can compare movement on one timeline.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="h-[320px]">
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Waiting for enough history to compare sensors.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 12 }}>
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
                  width={44}
                  domain={[0, 100]}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const point = payload[0].payload as ComparisonPoint
                    return (
                      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
                        <p className="mb-2 text-xs font-medium text-foreground">{label}</p>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>pH: <span className="font-mono text-foreground">{point.ph.toFixed(2)} pH</span></p>
                          <p>Temperature: <span className="font-mono text-foreground">{point.temperatureC.toFixed(2)} °C</span></p>
                          <p>Turbidity: <span className="font-mono text-foreground">{point.turbidityPercent.toFixed(2)} %</span></p>
                          <p>Flow: <span className="font-mono text-foreground">{point.flowRateLMin.toFixed(2)} L/min</span></p>
                        </div>
                      </div>
                    )
                  }}
                />
                <Legend />
                {METRICS.map((metric) => (
                  <Line
                    key={metric.key}
                    type="monotone"
                    dataKey={metric.key}
                    name={metric.label}
                    stroke={metric.color}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
                <Brush dataKey="time" height={22} travellerWidth={8} fill="hsl(var(--secondary))" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
