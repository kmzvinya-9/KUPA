# ESP32 Water Monitor - Complete Setup Guide

## ✅ All Issues Fixed - Error-Free Code

### **Changes Implemented:**
1. **LCD Cycle 2 Bug Fixed** - Both cycles now display properly (Temp/pH AND Turbidity/Color)
2. **Reduced Delays** - ESP32 sampling runs every 500ms, with fast tank scanning and non-blocking offline upload
3. **API Key Configuration** - Created `.env.local` for proper authentication
4. **Network Configuration** - ESP32 configured to send to `192.168.1.142:3000`
5. **All Comments Updated** - Code comments now match actual values

---

## 🚀 Step-by-Step Setup Instructions

### **Step 1: Install Dashboard Dependencies**
```bash
# Open Command Prompt in the project folder
cd C:\Users\BASTARD\Desktop\codexdash\IOT_residue_dashboard_ready

# Install Node.js dependencies
npm install
```

### **Step 2: Start the Dashboard**
```bash
# Start the Next.js development server
npm run dev
```
**Expected Output:** 
```
- Local: http://localhost:3000
- Ready in XXXms
```

### **Step 3: Configure ESP32**

#### 3.1 Update secrets.h (if needed)
The file `ESP32/esp32_water_monitor_sender/secrets.h` should contain:
```cpp
#define WIFI_SSID "Nyamutswa"
#define WIFI_PASSWORD "tende#01"
#define DEVICE_ID "ESP32-WATER-01"
#define API_KEY "esp32-water-2026"
#define SERVER_URL "http://192.168.1.142:3000/api/ingest"
```

#### 3.2 Upload ESP32 Code
1. Open Arduino IDE or PlatformIO
2. Open `ESP32/esp32_water_monitor_sender/esp32_water_monitor_sender.ino`
3. Select your ESP32 board and COM port
4. Click **Upload**

### **Step 4: Verify Connection**

#### Check ESP32 Serial Monitor:
Open Serial Monitor (115200 baud) and look for:
```
Setup complete.
[TANK SCAN] Level: X.X% | Water: YES/NO
POST /api/ingest -> 200
=== ESP32 Water Reading ===
WiFi: Connected
Water Present: YES/NO
Tank: X.X %
Temp: X.XX C (ok=1)
pH: X.XX at X.XXX V (ok=1)
Turbidity: X.XX % at X.XXX V (ok=1)
Flow: X.XX L/min (idle/active)
```

#### Check Dashboard:
1. Open browser to `http://localhost:3000`
2. Look for **"Connected"** status in the header
3. Sensor readings should update from the dashboard poll, while the ESP32 samples every 500ms
4. LCD should cycle between:
   - **Cycle 0**: Temperature and pH
   - **Cycle 1**: Turbidity and Color (R value)

---

## 🔧 Troubleshooting

### **Issue: ESP32 shows "POST /api/ingest -> 401"**
**Solution:** API key mismatch. Ensure:
- ESP32 `secrets.h` has `API_KEY "esp32-water-2026"`
- Dashboard `.env.local` has `DASHBOARD_API_KEY=esp32-water-2026`

### **Issue: Dashboard shows "ESP32 Offline"**
**Solutions:**
1. Check ESP32 is connected to same Wi-Fi network
2. Verify IP address `192.168.1.142` is your computer's local IP
   - Run `ipconfig` in Command Prompt to check
3. Ensure dashboard is running on port 3000
4. Check firewall isn't blocking port 3000

### **Issue: Next.js crashes with `CPU doesn't support the bmi2 instructions`**
**Cause:** That crash comes from Turbopack on older CPUs. It is not caused by the dashboard application code.

**Solution:** This repo now starts Next.js with Webpack by default:
- `npm run dev`
- `npm run build`

If someone runs `next dev` or `next build` manually on Next.js 16, Turbopack may still be used and can crash on that machine. Use the npm scripts above instead.

### **Issue: `Slow filesystem detected` warning**
**Cause:** This is a performance warning, not a dashboard code failure. It is common on Windows when the project lives in a slow Desktop, synced folder, antivirus-scanned folder, or network-backed location.

**Ways to improve it:**
1. Move the project to a fast local folder such as `C:\dev\IOT_residue_dashboard_ready`
2. Delete the `.next` folder after moving
3. Avoid OneDrive/network folders for development if possible

### **Issue: LCD only shows Cycle 0 (Temp/pH), not Cycle 1**
**Solution:** This bug is now fixed! Re-upload the updated ESP32 code.

### **Issue: Sensors show 0 readings**
**Possible causes:**
1. **No water in tank** - Ultrasonic sensor detects empty tank, so water-contact sensors are disabled
2. **Sensor wiring issue** - Check connections
3. **Calibration needed** - Use serial commands to calibrate sensors

### **Issue: Readings are slow or delayed**
**Solution:** Sensor sampling is 500ms and dashboard polling is 2 seconds. If still slow:
1. Check Wi-Fi signal strength
2. Ensure no network congestion
3. Verify ESP32 isn't in WiFi retry mode

---

## 📊 Expected Behavior

### **Dashboard Display:**
- **Connection Status**: "Connected" (green dot)
- **Update Frequency**: ESP32 samples every 500ms; dashboard polls every 2 seconds
- **Charts**: Real-time updates with 5-minute buckets
- **Alerts**: Automatic detection of anomalies

### **ESP32 Serial Output:**
```
[TANK SCAN] Level: 45.2% | Water: YES
POST /api/ingest -> 200
=== ESP32 Water Reading ===
WiFi: Connected
Dashboard: Online
Queue: 0
Water Present: YES
Tank: 45.2 %
Temp: 24.50 C (ok=1)
pH: 7.20 at 1.234 V (ok=1)
Turbidity: 85.00 % at 0.567 V (ok=1)
Flow: 0.00 L/min (idle)
```

### **LCD Display Cycling:**
- **Online**: Temperature/pH, turbidity/color, flow when active, and tank level/volume
- **Dashboard offline**: First line shows `OFFLINE SD:####`; second line continues cycling live sensor readings
- **Reconnected with stored data**: First line shows `SYNC SD:####` while SD records upload before live records

---

## Offline SD Recovery

If Wi-Fi or the dashboard API is unavailable, the ESP32 continues reading sensors and writes each telemetry payload to `/pending_queue.jsonl` on the SD card. When the dashboard is reachable again, queued SD records are uploaded first in small batches; current live readings are held in the same queue until the older offline records have been accepted.

This keeps LCD and sensor response real-time while still preserving record order for the dashboard history.

---

## 🔍 Sensor Calibration Commands

Send these commands via Serial Monitor to calibrate sensors:

```
help                          # Show all commands
status                        # Show calibration status
cal all                       # Calibrate all sensors
cal ph7                       # Calibrate pH to neutral (7.0)
cal turbidity-clear           # Calibrate turbidity for clear water
cal turbidity-dirty           # Calibrate turbidity for dirty water
cal color                     # Calibrate color sensor baseline
cal reset                     # Reset all calibrations to defaults
```

---

## 📁 File Structure

```
IOT_residue_dashboard_ready/
├── .env.local                    # API key configuration (CREATED)
├── .env.example                  # Example configuration
├── package.json                  # Node.js dependencies
├── tsconfig.json                 # TypeScript config
├── app/
│   ├── page.tsx                  # Main dashboard page
│   └── api/
│       ├── ingest/route.ts       # ESP32 data ingestion endpoint
│       ├── latest/route.ts       # Latest reading API
│       └── history/route.ts      # Historical data API
├── components/dashboard/
│   ├── dashboard-page.tsx        # Main dashboard component (UPDATED)
│   ├── tank-level.tsx
│   ├── ph-gauge.tsx
│   ├── turbidity-gauge.tsx
│   ├── flow-gauge.tsx
│   └── ... (other sensor components)
├── lib/
│   ├── telemetry-store.ts        # Data storage and normalization
│   ├── calibration-store.ts      # Calibration management
│   └── reporting.ts              # Alert generation
├── data/                         # Telemetry history storage
├── ESP32/
│   └── esp32_water_monitor_sender/
│       ├── esp32_water_monitor_sender.ino  # Main ESP32 code (UPDATED)
│       ├── secrets.h                       # WiFi and API config
│       └── platformio.ini                  # PlatformIO config
└── SETUP_GUIDE.md               # This file
```

---

## 🎯 Quick Start Checklist

- [ ] Run `npm install` in project folder
- [ ] Create `.env.local` file (already done)
- [ ] Start dashboard with `npm run dev`
- [ ] Verify dashboard is running at `http://localhost:3000`
- [ ] Update ESP32 `secrets.h` with correct IP (if needed)
- [ ] Upload ESP32 code
- [ ] Open ESP32 Serial Monitor (115200 baud)
- [ ] Check for "POST /api/ingest -> 200" messages
- [ ] Open dashboard in browser
- [ ] Verify "Connected" status and sensor readings
- [ ] Check LCD cycles between Temp/pH and Turbidity/Color

---

## 📞 Support

If you encounter any issues:
1. Check ESP32 Serial Monitor for error messages
2. Check browser console (F12) for dashboard errors
3. Verify network connectivity between ESP32 and computer
4. Ensure firewall allows connections on port 3000

**Offline SD buffering, fast startup, and real-time sensor/LCD response are enabled.**
