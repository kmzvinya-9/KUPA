"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Settings2 } from "lucide-react"

interface PinConfig {
  component: string
  pin: string
  purpose: string
  logic: string
}

const pinConfigurations: PinConfig[] = [
  { component: "Voltage Sensor", pin: "GPIO 35", purpose: "Battery Monitor", logic: "ADC / 3.3V max at pin" },
  { component: "pH Sensor", pin: "GPIO 32", purpose: "Analog Input", logic: "3.3V" },
  { component: "Turbidity", pin: "GPIO 34", purpose: "Analog Input", logic: "3.3V" },
  { component: "Flow Sensor", pin: "GPIO 33", purpose: "Pulse Input", logic: "3.3V/5V" },
  { component: "Ultrasonic Trig", pin: "GPIO 17", purpose: "Level Trigger", logic: "5V" },
  { component: "Ultrasonic Echo", pin: "GPIO 16", purpose: "Level Response", logic: "Use divider to 3.3V" },
  { component: "DS18B20 Temp", pin: "GPIO 13", purpose: "One-Wire", logic: "3.3V" },
  { component: "Color (S0, S1)", pin: "2, 15", purpose: "Freq Scaling", logic: "3.3V" },
  { component: "Color (S2, S3)", pin: "27, 4", purpose: "Freq Control", logic: "3.3V" },
  { component: "Color (OUT)", pin: "GPIO 25", purpose: "Freq Pulse", logic: "3.3V" },
  { component: "SD Card (CS, MOSI, MISO, SCK)", pin: "5, 23, 19, 18", purpose: "SPI Logging", logic: "5V module / logic-shifted" },
  { component: "LCD (SDA, SCL)", pin: "21, 22", purpose: "I2C Comm", logic: "5V backlight / I2C" },
]

export function PinConfiguration() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Settings2 className="h-4 w-4" />
          Hardware Pin Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 text-left font-medium text-muted-foreground">Component</th>
                <th className="pb-2 text-left font-medium text-muted-foreground">Pin</th>
                <th className="pb-2 text-left font-medium text-muted-foreground">Purpose</th>
                <th className="pb-2 text-left font-medium text-muted-foreground">Logic</th>
              </tr>
            </thead>
            <tbody>
              {pinConfigurations.map((config, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="py-2 text-foreground">{config.component}</td>
                  <td className="py-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {config.pin}
                    </Badge>
                  </td>
                  <td className="py-2 text-muted-foreground">{config.purpose}</td>
                  <td className="py-2">
                    <Badge variant="secondary" className="text-xs">
                      {config.logic}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
