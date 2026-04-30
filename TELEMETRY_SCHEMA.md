# Water Quality Telemetry Schema

## Overview

This document defines the telemetry data schema used for communication between the ESP32 water quality monitor and the dashboard backend.

## Telemetry Record Schema

```json
{
  "recordId": "string",
  "deviceId": "string",
  "timestamp": "string (ISO 8601) or Unix epoch",
  "receivedAt": "number (Unix epoch ms, assigned by server)",
  
  "hasWater": "boolean",
  "temperatureC": "number (0-125)",
  "ph": "number (0-14)",
  "turbidityPercent": "number (0-100)",
  "flowRateLMin": "number (0-200)",
  "tankLevelPercent": "number (0-100)",
  "tankCapacity": "number (liters)",
  
  "colorR": "number (0-255)",
  "colorG": "number (0-255)",
  "colorB": "number (0-255)",
  "lux": "number (0-200000)",
  
  "batteryLevel": "number (0-100, percent)",
  "batteryVoltage": "number (volts)",
  "isCharging": "boolean",
  
  "pulseCount": "number",
  "sdCardActive": "boolean",
  "sdCardWriting": "boolean",
  "sdCardUsage": "number (0-100, percent)",
  "uptimeSeconds": "number",
  "pendingQueueCount": "number",
  
  "temperatureSensorOk": "boolean",
  "phSensorOk": "boolean",
  "turbiditySensorOk": "boolean",
  "ultrasonicSensorOk": "boolean",
  "colorSensorOk": "boolean",
  "flowSensorState": "active | idle | no_water | unknown",
  
  "sensorsForcedOff": "boolean (only for manual maintenance mode)",
  
  "phVoltage": "number (0-3.3 volts)",
  "turbidityVoltage": "number (0-3.3 volts)",
  
  "screeningScore": "number (0-100)",
  "screeningStatus": "low | moderate | high",
  "screeningSummary": "string"
}
```

## Field Descriptions

### Identity Fields
| Field | Type | Description |
|-------|------|-------------|
| `recordId` | string | Unique identifier: `{deviceId}-{bootId}-{counter}` |
| `deviceId` | string | Device identifier: `ESP32-WATER-01` |
| `timestamp` | string | ISO 8601 or Unix epoch (seconds) |
| `receivedAt` | number | Server-assigned Unix epoch milliseconds |

### Water Quality Sensors
| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `hasWater` | boolean | - | True when tank has water (tankLevel > 0.5%) |
| `temperatureC` | number | 0-125 | Water temperature in Celsius |
| `ph` | number | 0-14 | pH level (7 = neutral) |
| `turbidityPercent` | number | 0-100 | Water clarity (0% = very turbid, 100% = clear) |
| `flowRateLMin` | number | 0-200 | Flow rate in liters per minute |

### Tank Monitoring
| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `tankLevelPercent` | number | 0-100 | Current water level percentage |
| `tankCapacity` | number | 1-100000 | Tank capacity in liters |

### Color/Light Sensors
| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `colorR` | number | 0-255 | Red channel intensity |
| `colorG` | number | 0-255 | Green channel intensity |
| `colorB` | number | 0-255 | Blue channel intensity |
| `lux` | number | 0-200000 | Light intensity in lux |

### Power (Optional - Not Used for Sensor Control)
| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `batteryLevel` | number | 0-100 | Battery percentage |
| `batteryVoltage` | number | 0-25 | Battery voltage in volts |
| `isCharging` | boolean | - | True if battery is charging |

### System Status
| Field | Type | Description |
|-------|------|-------------|
| `pulseCount` | number | Flow sensor pulse count since last reading |
| `sdCardActive` | boolean | True if SD card is available |
| `sdCardWriting` | boolean | True if currently writing to SD |
| `sdCardUsage` | number | SD card usage percentage |
| `uptimeSeconds` | number | Seconds since device boot |
| `pendingQueueCount` | number | Offline records still waiting on the SD card for dashboard upload |

### Sensor Health
| Field | Type | Description |
|-------|------|-------------|
| `temperatureSensorOk` | boolean | DS18B20 sensor responding |
| `phSensorOk` | boolean | pH probe signal valid |
| `turbiditySensorOk` | boolean | Turbidity sensor signal valid |
| `ultrasonicSensorOk` | boolean | Ultrasonic echo detected |
| `colorSensorOk` | boolean | Color sensor pulses detected |
| `flowSensorState` | string | `active`, `idle`, `no_water`, or `unknown` |

### Maintenance Mode
| Field | Type | Description |
|-------|------|-------------|
| `sensorsForcedOff` | boolean | **Only set manually for maintenance** - never battery-forced |

### Diagnostic Voltages
| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `phVoltage` | number | 0-3.3 | pH probe output voltage |
| `turbidityVoltage` | number | 0-3.3 | Turbidity sensor output voltage |

### Water Quality Screening
| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `screeningScore` | number | 0-100 | Composite water quality score |
| `screeningStatus` | string | low/moderate/high | Risk level |
| `screeningSummary` | string | - | Human-readable assessment |

## Example Valid Telemetry JSON

```json
{
  "recordId": "ESP32-WATER-01-3956129833-112",
  "deviceId": "ESP32-WATER-01",
  "timestamp": "2026-04-28T11:30:00.000Z",
  "hasWater": true,
  "temperatureC": 25.6,
  "ph": 6.8,
  "turbidityPercent": 12.4,
  "flowRateLMin": 1.2,
  "tankLevelPercent": 76,
  "tankCapacity": 5,
  "colorR": 120,
  "colorG": 115,
  "colorB": 90,
  "lux": 340,
  "batteryLevel": null,
  "batteryVoltage": null,
  "isCharging": false,
  "pulseCount": 40,
  "sdCardActive": true,
  "sdCardWriting": false,
  "sdCardUsage": 0.02,
  "uptimeSeconds": 694,
  "pendingQueueCount": 0,
  "temperatureSensorOk": true,
  "phSensorOk": true,
  "turbiditySensorOk": true,
  "ultrasonicSensorOk": true,
  "colorSensorOk": true,
  "flowSensorState": "idle",
  "sensorsForcedOff": false,
  "phVoltage": 2.45,
  "turbidityVoltage": 1.2,
  "screeningScore": 82,
  "screeningStatus": "low",
  "screeningSummary": "Screening only: current sensors look stable, but they still cannot identify specific drug residues without lab confirmation."
}
```

## API Endpoints

### POST /api/ingest
Accepts telemetry data from ESP32.

**Headers:**
- `Content-Type: application/json`
- `x-api-key: {API_KEY}`

**Request Body:** Telemetry record as shown above

**Success Response (200):**
```json
{
  "ok": true,
  "connected": true,
  "accepted": 1,
  "duplicates": 0,
  "total": 1
}
```

**Error Responses:**
- `400`: Invalid JSON or missing required fields
- `401`: Invalid API key
- `403`: Invalid device ID

### GET /api/latest
Returns the most recent telemetry record.

**Response (200):**
```json
{
  "connected": true,
  "staleAfterMs": 15000,
  "reading": { /* telemetry record */ }
}
```

### GET /api/history
Returns historical telemetry records.

**Response (200):**
```json
{
  "records": [ /* array of telemetry records */ ]
}
```

## Important Notes

1. **No Battery Shutdown**: Sensors are NEVER turned off due to battery voltage. The `sensorsForcedOff` field is only used for manual maintenance mode.

2. **Zero Values**: When `hasWater` is false (tank empty), water-contact sensors legitimately return zero. This is expected behavior.

3. **Timestamp Handling**: The server assigns `receivedAt` using `Date.now()`. The ESP32 can send Unix epoch seconds or ISO 8601 strings.

4. **Validation**: The backend validates all numeric ranges and rejects impossible readings.

5. **Deduplication**: Records with the same `recordId` are not stored twice.
