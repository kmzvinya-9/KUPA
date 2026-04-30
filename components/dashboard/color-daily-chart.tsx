"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Bar,
  Brush,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

interface ColorDailyPoint {
  date: string
  rMin: number
  rMax: number
  rAvg: number
  gMin: number
  gMax: number
  gAvg: number
  bMin: number
  bMax: number
  bAvg: number
}

interface ColorDailyChartProps {
  title: string
  data: ColorDailyPoint[]
}

function formatValue(value: number) {
  return value.toFixed(0)
}

// Color palettes for RGB channels with gradients
const R_PALETTE = ["#ef4444", "#dc2626", "#b91c1c", "#f87171", "#fca5a5"]
const G_PALETTE = ["#22c55e", "#16a34a", "#15803d", "#4ade80", "#86efac"]
const B_PALETTE = ["#3b82f6", "#2563eb", "#1d4ed8", "#60a5fa", "#93c5fd"]

// Prepare data with range values
function prepareData(data: ColorDailyPoint[]) {
  return data.map((d) => ({
    ...d,
    rRange: d.rMax - d.rMin,
    gRange: d.gMax - d.gMin,
    bRange: d.bMax - d.bMin,
  }))
}

export function ColorDailyChart({
  title,
  data,
}: ColorDailyChartProps) {
  const chartData = prepareData(data)

  return (
    <Card>
      <CardHeader className="space-y-3 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {title}
            </CardTitle>
            <div className="mt-2 flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-red-400">Red</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-green-400">Green</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-blue-400">Blue</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">7-day range</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        <div className="h-[280px]">
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No daily color data available...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 12 }}>
                <defs>
                  {/* Red gradient */}
                  <linearGradient id="gradient-red-daily" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
                  </linearGradient>
                  {/* Green gradient */}
                  <linearGradient id="gradient-green-daily" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
                  </linearGradient>
                  {/* Blue gradient */}
                  <linearGradient id="gradient-blue-daily" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>

                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.35} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  tickMargin={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  tickMargin={8}
                  domain={[0, 255]}
                  width={36}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const point = payload[0].payload as ColorDailyPoint
                    return (
                      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
                        <p className="mb-2 text-xs font-medium text-foreground">{label}</p>
                        <div className="space-y-1 text-xs">
                          <p className="text-red-400">
                            Red: {formatValue(point.rMin)} - {formatValue(point.rMax)} (avg {formatValue(point.rAvg)})
                          </p>
                          <p className="text-green-400">
                            Green: {formatValue(point.gMin)} - {formatValue(point.gMax)} (avg {formatValue(point.gAvg)})
                          </p>
                          <p className="text-blue-400">
                            Blue: {formatValue(point.bMin)} - {formatValue(point.bMax)} (avg {formatValue(point.bAvg)})
                          </p>
                        </div>
                      </div>
                    )
                  }}
                />

                {/* Red Channel - Range bar with gradient */}
                <Bar
                  dataKey="rMin"
                  fill="transparent"
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="rRange"
                  stackId="r"
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`r-cell-${index}`}
                      fill={R_PALETTE[index % R_PALETTE.length]}
                      fillOpacity={0.75}
                    />
                  ))}
                </Bar>
                <Line
                  type="monotone"
                  dataKey="rAvg"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#ef4444", stroke: "hsl(var(--background))", strokeWidth: 1.5 }}
                  isAnimationActive={false}
                />

                {/* Green Channel - Range bar with gradient */}
                <Bar
                  dataKey="gMin"
                  fill="transparent"
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="gRange"
                  stackId="g"
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`g-cell-${index}`}
                      fill={G_PALETTE[index % G_PALETTE.length]}
                      fillOpacity={0.75}
                    />
                  ))}
                </Bar>
                <Line
                  type="monotone"
                  dataKey="gAvg"
                  stroke="#22c55e"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#22c55e", stroke: "hsl(var(--background))", strokeWidth: 1.5 }}
                  isAnimationActive={false}
                />

                {/* Blue Channel - Range bar with gradient */}
                <Bar
                  dataKey="bMin"
                  fill="transparent"
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="bRange"
                  stackId="b"
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`b-cell-${index}`}
                      fill={B_PALETTE[index % B_PALETTE.length]}
                      fillOpacity={0.75}
                    />
                  ))}
                </Bar>
                <Line
                  type="monotone"
                  dataKey="bAvg"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#3b82f6", stroke: "hsl(var(--background))", strokeWidth: 1.5 }}
                  isAnimationActive={false}
                />

                <Brush
                  dataKey="date"
                  height={22}
                  travellerWidth={8}
                  stroke="#64748b"
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