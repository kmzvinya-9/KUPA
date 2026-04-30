"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Droplets } from "lucide-react"

interface FlowGaugeProps {
  flowRate: number // L/min
  maxFlow?: number
  pulseCount?: number
  isActive: boolean
}

export function FlowGauge({
  flowRate,
  maxFlow = 10,
  pulseCount = 0,
  isActive,
}: FlowGaugeProps) {
  const percentage = Math.min((flowRate / maxFlow) * 100, 100)
  
  // Flow status
  const getFlowStatus = () => {
    if (flowRate < 0.5) return { label: "No Flow", color: "text-muted-foreground" }
    if (flowRate < 2) return { label: "Low Flow", color: "text-warning" }
    if (flowRate < 5) return { label: "Normal Flow", color: "text-primary" }
    return { label: "High Flow", color: "text-accent" }
  }
  
  const status = getFlowStatus()

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Droplets className="h-4 w-4" />
          Flow Sensor (YF-S201)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Pipe Visualization */}
          <div className="relative flex-shrink-0">
            {/* Pipe background */}
            <div className="relative h-32 w-16 overflow-hidden rounded-lg border-2 border-border bg-secondary/30">
              {/* Pipe interior */}
              <div className="absolute inset-1 overflow-hidden rounded bg-background">
                {/* Water flow animation */}
                {isActive && (
                  <div className="absolute inset-0 overflow-hidden">
                    {/* Animated water droplets */}
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-accent/60"
                        style={{
                          top: `${(i * 25) % 100}%`,
                          animation: `flowDrop 1s linear infinite`,
                          animationDelay: `${i * 0.2}s`,
                        }}
                      />
                    ))}
                    {/* Flow stream */}
                    <div 
                      className="absolute inset-x-2 bg-gradient-to-b from-accent/40 via-accent/60 to-accent/40"
                      style={{
                        top: 0,
                        height: "100%",
                        animation: "flowStream 0.5s linear infinite",
                      }}
                    />
                  </div>
                )}
                
                {/* No flow indicator */}
                {!isActive && (
                  <div className="flex h-full items-center justify-center">
                    <span className="text-xs text-muted-foreground">IDLE</span>
                  </div>
                )}
              </div>
              
              {/* Flow direction arrows */}
              <div className="absolute -right-1 top-1/2 -translate-y-1/2">
                <div className={cn(
                  "text-lg",
                  isActive ? "text-accent animate-pulse" : "text-muted-foreground"
                )}>
                  →
                </div>
              </div>
            </div>
            
            {/* Flow rate indicator bar */}
            <div className="absolute -left-2 top-0 h-full w-1 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  "w-full rounded-full transition-all duration-500",
                  isActive ? "bg-accent" : "bg-muted-foreground/30"
                )}
                style={{ height: `${percentage}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="flex-1 space-y-3">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">
                  {flowRate.toFixed(2)}
                </span>
                <span className="text-sm text-muted-foreground">L/min</span>
              </div>
              <p className={cn("text-sm font-medium", status.color)}>
                {status.label}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Flow Rate</span>
                <span className="font-mono text-foreground">{percentage.toFixed(0)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    isActive ? "bg-accent" : "bg-muted-foreground/30"
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-secondary/50 p-2">
                <p className="text-muted-foreground">Pulse Count</p>
                <p className="font-mono text-foreground">{pulseCount}</p>
              </div>
              <div className="rounded bg-secondary/50 p-2">
                <p className="text-muted-foreground">K-Factor</p>
                <p className="font-mono text-foreground">7.5 Q</p>
              </div>
            </div>
          </div>
        </div>

        {/* CSS for flow animation */}
        <style jsx>{`
          @keyframes flowDrop {
            0% { transform: translateX(-50%) translateY(-20px); opacity: 0; }
            20% { opacity: 1; }
            80% { opacity: 1; }
            100% { transform: translateX(-50%) translateY(140px); opacity: 0; }
          }
          @keyframes flowStream {
            0% { background-position: 0 0; }
            100% { background-position: 0 20px; }
          }
        `}</style>
      </CardContent>
    </Card>
  )
}
