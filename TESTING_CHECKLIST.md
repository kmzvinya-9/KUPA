# Water Quality Monitoring System - Testing Checklist

## Pre-Testing Setup

### 1. Environment Preparation
- [ ] Install Node.js (v18+) and npm
- [ ] Install Arduino IDE and ESP32 board support
- [ ] Install required Arduino libraries:
  - ArduinoJson (v7.x)
  - OneWire
  - DallasTemperature
  - LiquidCrystal_I2C
  - SPI
  - SD
- [ ] Clone or download the project

### 2. Dashboard Backend Setup
```bash
# Install dependencies
npm install

# Create .env.local file with:
DASHBOARD_API_KEY=esp32-water-2026
DEVICE_ID=ESP32-WATER-01

# Start development server
npm run dev
```
- [ ] Server starts successfully on http://localhost:3000
- [ ] No console errors in terminal
- [ ] Dashboard accessible in browser

### 3. ESP32 Firmware Setup
- [ ] Open `ESP32/esp32_water_monitor_sender/esp32_water_monitor_sender.ino` in Arduino IDE
- [ ] Update `secrets.h` with:
  - Your Wi-Fi SSID and password
  - Your computer's local IP address in `SERVER_URL` (e.g., `http://192.168.1.100:3000/api/ingest`)
  - Verify `DEVICE_ID` matches dashboard expectation
  - Verify `API_KEY` matches dashboard expectation
- [ ] Select correct ESP32 board and COM port
- [ ] Upload firmware to ESP32

---

## Serial Monitor Testing Steps

### Step 1: Initial Boot
1. Open Serial Monitor (115200 baud)
2. Reset ESP32
3. Verify output:

**Expected Output:**
```
Water Monitor
Booting...
[TANK SCAN] Level: X.X% | Water: YES/NO
Sensor initialization complete.
Setup complete.
```

- [ ] ESP32 connects to Wi-Fi (shows "Connected")
- [ ] NTP time sync succeeds (timestamp > 1700000000)
- [ ] Sensors initialize without errors
- [ ] No battery protection messages appear

### Step 2: Continuous Sensor Reading
Observe the serial output for 30 seconds:

**Expected Output (repeating every 2 seconds):**
```
[TANK SCAN] Level: X.X% | Water: YES/NO
=== ESP32 Water Reading ===
WiFi: Connected
Queue: 0
Water Present: YES/NO
Tank: X.X %
Temp: X.XX C (ok=1)
pH: X.XX at X.XXX V (ok=1)
Turbidity: X.XX % at X.XXX V (ok=1)
Flow: X.XX L/min (idle/active)
[PAYLOAD] Size: XXX bytes
POST /api/ingest -> 200
```

- [ ] Readings update every 2 seconds (not 200ms)
- [ ] Temperature shows reasonable value (15-35°C typical)
- [ ] pH shows reasonable value (6-8 typical for tap water)
- [ ] Turbidity shows reasonable value
- [ ] Flow rate shows 0.00 when no water flowing
- [ ] Tank level updates when water level changes
- [ ] No "Battery protection mode" messages
- [ ] No sensor shutdown due to battery voltage
- [ ] POST returns HTTP 200

### Step 3: Test Sensor Responses
**Temperature Sensor:**
- [ ] Touch DS18B20 with finger → temperature increases
- [ ] Serial shows `Temp: X.XX C (ok=1)`

**pH Sensor:**
- [ ] pH probe in water → shows pH value
- [ ] Serial shows `pH: X.XX at X.XXX V (ok=1)`

**Turbidity Sensor:**
- [ ] Sensor in clear water → high percentage
- [ ] Sensor in dirty water → low percentage

**Ultrasonic Sensor:**
- [ ] Move hand over sensor → tank level changes

**Flow Sensor:**
- [ ] Blow through flow sensor or run water
- [ ] Serial shows `Flow: X.XX L/min (active)`
- [ ] Stop flow → shows `(idle)`

### Step 4: Test Wi-Fi Reconnection
1. Turn off Wi-Fi router
2. Wait 10 seconds
3. Turn router back on

- [ ] ESP32 attempts to reconnect
- [ ] Reconnects automatically when Wi-Fi returns
- [ ] Queued data is sent (queue count decreases)

---

## Dashboard Testing Steps

### Step 1: Initial Dashboard Load
1. Open browser to http://localhost:3000
2. Check Overview tab

**Expected:**
- [ ] Dashboard loads without errors
- [ ] No hydration mismatch warnings in browser console
- [ ] Status shows "ESP32 Offline" initially (if ESP32 not sending)
- [ ] All sensor cards display
- [ ] No "Battery protection mode" messages

### Step 2: Live Data Display
1. Start ESP32 and ensure it's sending data
2. Refresh dashboard

**Expected:**
- [ ] Status changes to "Live" with green indicator
- [ ] Last update timestamp shows recent time
- [ ] Sensor values update every 2 seconds
- [ ] Values match Serial Monitor readings
- [ ] No stale zeros when ESP32 is sending real data

### Step 3: Sensor Cards
**Thermometer Gauge:**
- [ ] Shows current temperature
- [ ] Needle moves when temperature changes

**pH Gauge:**
- [ ] Shows current pH value
- [ ] Classification updates (Acidic/Screening Band/Alkaline)

**Turbidity Gauge:**
- [ ] Shows turbidity percentage
- [ ] Updates when water clarity changes

**Flow Gauge:**
- [ ] Shows flow rate
- [ ] Pulse count increments when flow detected

**Tank Level:**
- [ ] Shows tank percentage
- [ ] Shows volume in liters

### Step 4: System Status Panel
- [ ] Operating Mode shows correctly (active/static/error)
- [ ] Flow Detection shows correct status
- [ ] Calibration status displays
- [ ] Uptime increases over time
- [ ] SD Card status shows Active/Not Detected
- [ ] No battery-related error messages

### Step 5: Analysis Tab
1. Click "Analysis" tab
2. Wait for data to accumulate

**Expected:**
- [ ] Real-time charts display
- [ ] 24-hour history charts show data
- [ ] Charts update as new data arrives
- [ ] Daily range charts show min/max/avg
- [ ] No chart rendering errors

---

## API Testing Steps

### Test /api/ingest
```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-api-key: esp32-water-2026" \
  -d '{"recordId":"test-1","deviceId":"ESP32-WATER-01","hasWater":true,"temperatureC":25.0,"ph":7.0}'
```

**Expected Response:**
```json
{"ok":true,"connected":true,"accepted":1,"duplicates":0,"total":1}
```

- [ ] Returns HTTP 200
- [ ] Response contains `ok: true`

### Test /api/latest
```bash
curl http://localhost:3000/api/latest
```

**Expected Response:**
```json
{"connected":true,"staleAfterMs":15000,"reading":{...}}
```

- [ ] Returns HTTP 200
- [ ] Response contains `connected: true/false`
- [ ] Reading contains all expected fields

---

## End-to-End Communication Verification

### Final Confirmation Checklist

**ESP32 → Dashboard Communication:**
- [ ] ESP32 connects to Wi-Fi
- [ ] ESP32 reads sensors continuously
- [ ] ESP32 sends telemetry every 2 seconds
- [ ] ESP32 Serial shows POST success (HTTP 200)
- [ ] No "Battery protection mode" in Serial output
- [ ] Sensors are NOT turned off due to battery voltage

**Dashboard ← ESP32 Communication:**
- [ ] Dashboard polls /api/latest every 2 seconds
- [ ] Dashboard shows "Live" status when ESP32 is sending
- [ ] Dashboard shows "Offline" status when ESP32 stops
- [ ] Sensor values on dashboard match ESP32 Serial readings
- [ ] Charts update in real-time as new data arrives
- [ ] No hydration errors in browser console
- [ ] No "Battery protection mode" messages on dashboard

**Data Persistence:**
- [ ] Telemetry is stored in `data/telemetry-latest.json`
- [ ] Historical records stored in `data/telemetry-history.jsonl`
- [ ] Records persist after dashboard restart
- [ ] Duplicate records are not stored

**Email Reports:**
- [ ] Reports include actual telemetry data
- [ ] Reports include generated charts
- [ ] Reports show correct statistics (min/max/avg)
- [ ] No "forced shutdown" counts (always 0)
- [ ] No battery protection messages in reports

---

## Troubleshooting

### ESP32 Won't Connect to Wi-Fi
1. Verify SSID and password in `secrets.h`
2. Check Wi-Fi signal strength
3. Ensure ESP32 is powered adequately

### Dashboard Shows Offline But ESP32 Shows Connected
1. Verify `SERVER_URL` in `secrets.h` matches your computer's IP
2. Check firewall settings (port 3000 must be open)
3. Ensure dashboard is running (`npm run dev`)
4. Check that API keys match between ESP32 and `.env.local`

### Sensor Readings Show Zero
1. Check sensor wiring
2. Verify sensors are powered
3. Check if tank is empty (zeros are expected when no water)

### Charts Not Updating
1. Check browser console for errors
2. Verify /api/latest is returning data
3. Try refreshing the dashboard

---

## Success Criteria

The system is working correctly when:

1. ✅ ESP32 reads sensors continuously without battery-forced shutdowns
2. ✅ Dashboard displays real-time readings that match ESP32 values
3. ✅ Charts update automatically as new data arrives
4. ✅ Online/offline status accurately reflects ESP32 connection
5. ✅ No "Battery protection mode" messages appear anywhere
6. ✅ Historical data persists across restarts
7. ✅ Email reports contain real telemetry data and charts
8. ✅ No hydration errors in the browser console
9. ✅ API endpoints return valid responses
10. ✅ Sensors are only zeroed when tank is empty (not due to battery)