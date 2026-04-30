"use client"

import { useEffect, useMemo, useState } from "react"
import { useTheme } from "next-themes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Droplet, Moon, RefreshCw, Settings, Sun, Wifi, WifiOff } from "lucide-react"
import { BatteryIndicator } from "@/components/dashboard/battery-indicator"
import { cn } from "@/lib/utils"

interface DashboardHeaderProps {
  isConnected: boolean
  lastUpdate: string | null
  onRefresh: () => void
  isRefreshing?: boolean
}

export function DashboardHeader({
  isConnected,
  lastUpdate,
  onRefresh,
  isRefreshing = false,
}: DashboardHeaderProps) {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const displayLastUpdate = useMemo(() => lastUpdate ?? "--:--:--", [lastUpdate])
  const selectedTheme = mounted && (theme === "light" || theme === "dark") ? theme : "dark"

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Droplet className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Water Quality Monitor
            </h1>
            <p className="text-xs text-muted-foreground">
              Residue Screening Dashboard
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* ESP32 Connection Status Indicator (shown as battery/mains icon) */}
          <BatteryIndicator 
            level={isConnected ? 100 : 0}
            voltage={isConnected ? 5.0 : 0}
            mainsMode={true}
          />

          <div className="hidden items-center gap-2 lg:flex">
            <span className="text-xs text-muted-foreground">Last update:</span>
            <span className="font-mono text-xs text-foreground">{displayLastUpdate}</span>
          </div>

          <Badge
            variant={isConnected ? "default" : "destructive"}
            className="flex items-center gap-1.5"
          >
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3" />
                <span>Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                <span>Offline</span>
              </>
            )}
          </Badge>

          <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            <span className="sr-only">Refresh</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings className="h-4 w-4" />
                <span className="sr-only">Settings</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Screen Mode</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={selectedTheme} onValueChange={setTheme}>
                <DropdownMenuRadioItem value="light">
                  <Sun className="h-4 w-4" />
                  Light screen
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <Moon className="h-4 w-4" />
                  Dark screen
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
