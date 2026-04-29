"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Activity } from "lucide-react"

interface ColorDataPoint {
  time: string
  r: number
  g: number
  b: number
}

interface ColorChannelChartProps {
  title: string
  data: ColorDataPoint[]
  showLiveIndicator?: boolean
}

function formatValue(value: number) {
  return value.toFixed(0)
}

export function ColorChannelChart({
  title,
  data,
  showLiveIndicator = true,
}: ColorChannelChartProps) {
  const currentR = data.length > 0 ? data[data.length - 1].r : null
  const currentG = data.length > 0 ? data[data.length - 1].g : null
  const currentB = data.length > 0 ? data[data.length - 1].b : null
  
  const avgR = data.length > 0 ? data.reduce((sum, point) => sum + point.r, 0) / data.length : null
  const avgG = data.length > 0 ? data.reduce((sum, point) => sum + point.g, 0) / data.length : null
  const avgB = data.length > 0 ? data.reduce((sum, point) => sum + point.b, 0) / data.length : null

  const getColorSwatch = () => {
    if (currentR === null || currentG === null || currentB === null) return "#64748b"
    return `rgb(${Math.round(currentR)}, ${Math.round(currentG)}, ${Math.round(currentB)})`
  }

  return (
    <Card>
      <CardHeader className="space-y-3 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {title}
            </CardTitle>
            <div className="mt-2 flex items-center gap-2">
              <div
                className="color-swatch h-6 w-6 rounded border border-border shadow-sm"
                style={{ backgroundColor: getColorSwatch() }}
              />
              <span className="font-mono text-xs text-muted-foreground">
                R: {currentR !== null ? formatValue(currentR) : "--"} | 
                G: {currentG !== null ? formatValue(currentG) : "--"} | 
                B: {currentB !== null ? formatValue(currentB) : "--"}
              </span>
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
              RGB Channels
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2">
            <p className="text-[11px] uppercase tracking-wide text-red-400">Red</p>
            <p className="font-mono text-sm text-foreground">
              {avgR !== null ? formatValue(avgR) : "--"} avg
            </p>
          </div>
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-2">
            <p className="text-[11px] uppercase tracking-wide text-green-400">Green</p>
            <p className="font-mono text-sm text-foreground">
              {avgG !== null ? formatValue(avgG) : "--"} avg
            </p>
          </div>
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-2">
            <p className="text-[11px] uppercase tracking-wide text-blue-400">Blue</p>
            <p className="font-mono text-sm text-foreground">
              {avgB !== null ? formatValue(avgB) : "--"} avg
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        <div className="h-[280px]">
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Waiting for color sensor data...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 12 }}>
                <defs>
                  <linearGradient id="gradient-red" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                    <stop offset="50%" stopColor="#ef4444" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradient-green" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                    <stop offset="50%" stopColor="#22c55e" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradient-blue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
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
                  domain={[0, 255]}
                  width={36}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const point = payload[0].payload as ColorDataPoint
                    return (
                      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
                        <p className="mb-2 text-xs font-medium text-foreground">{label}</p>
                        <div className="space-y-1 text-xs">
                          <p className="text-red-400">
                            Red: <span className="font-mono text-foreground">{formatValue(point.r)}</span>
                          </p>
                          <p className="text-green-400">
                            Green: <span className="font-mono text-foreground">{formatValue(point.g)}</span>
                          </p>
                          <p className="text-blue-400">
                            Blue: <span className="font-mono text-foreground">{formatValue(point.b)}</span>
                          </p>
                          <div 
                            className="mt-2 h-4 w-16 rounded border border-border"
                            style={{ backgroundColor: `rgb(${Math.round(point.r)}, ${Math.round(point.g)}, ${Math.round(point.b)})` }}
                          />
                        </div>
                      </div>
                    )
                  }}
                />

                {/* Red Channel */}
                <Area
                  type="monotone"
                  dataKey="r"
                  fill="url(#gradient-red)"
                  stroke="#ef4444"
                  strokeOpacity={0.5}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="r"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                  activeDot={false}
                />

                {/* Green Channel */}
                <Area
                  type="monotone"
                  dataKey="g"
                  fill="url(#gradient-green)"
                  stroke="#22c55e"
                  strokeOpacity={0.5}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="g"
                  stroke="#22c55e"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                  activeDot={false}
                />

                {/* Blue Channel */}
                <Area
                  type="monotone"
                  dataKey="b"
                  fill="url(#gradient-blue)"
                  stroke="#3b82f6"
                  strokeOpacity={0.5}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="b"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                  activeDot={{ r: 5, fill: "#3b82f6", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                />

                <Brush
                  dataKey="time"
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