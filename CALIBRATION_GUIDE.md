# Sensor Calibration Guide

This guide explains how to calibrate the water quality sensors using the dashboard's built-in calibration system.

## Overview

The calibration system allows you to calibrate sensors directly from the web dashboard. Calibration values are stored in `data/calibration.json` and persisted across sessions.

## Accessing Calibration

1. Open the dashboard at `http://localhost:3000`
2. Click on the **Configuration** tab
3. The **Sensor Calibration** panel will be displayed at the top

## Calibration Tabs

### pH Calibration

Calibrates the pH sensor using a pH 7.0 buffer solution.

**Requirements:**
- Water must be present in the tank
- pH sensor must be recognized and working

**Procedure:**
1. Immerse the pH probe in a pH 7.0 buffer solution
2. Wait for the reading to stabilize (about 30-60 seconds)
3. Click **Calibrate to pH 7.0**
4. The system will calculate and save the new offset

### Turbidity Calibration

Calibrates the turbidity sensor using clear and dirty water references.

**Requirements:**
- Water must be present in the tank
- Turbidity sensor must be recognized and working

**Two-Point Calibration:**

1. **Clear Water (0%):**
   - Use distilled or very clear water
   - Click **Calibrate Clear Water (0%)**
   - This sets the baseline for 0% turbidity

2. **Dirty Water (100%):**
   - Use very turbid water (add clay or sediment)
   - Click **Calibrate Dirty Water (100%)**
   - This sets the baseline for 100% turbidity

### Color Calibration

Calibrates the TCS3200/TCS230 color sensor baseline.

**Requirements:**
- Water must be present in the tank
- Color sensor must be recognized and working

**Procedure:**
1. Ensure the color sensor is in a neutral/clear environment
2. Click **Capture Color Baseline**
3. The current RGB values will be saved as the new baseline

### System Calibration

Provides system-wide calibration management.

**Options:**
- **Run All Calibrations:** Calibrates pH, turbidity (clear), and color sensors simultaneously
- **Reset to Defaults:** Resets all calibration values to factory defaults

## Calibration Tips

- Always ensure water is present before calibrating water-contact sensors
- Wait for sensor readings to stabilize before calibrating
- Use known reference solutions for best accuracy
- Recalibrate periodically for maintained accuracy
- The ESP32 also has serial-based calibration commands for advanced users

## Serial Commands (ESP32)

For advanced calibration via serial monitor, the ESP32 supports these commands:

```
help                      - Show available commands
status                    - Show current calibration status
cal ph7                   - Calibrate pH to 7.0
cal turbidity-clear       - Calibrate turbidity clear baseline
cal turbidity-dirty       - Calibrate turbidity dirty baseline
cal color                 - Calibrate color baseline
cal all                   - Run all calibrations
cal reset                 - Reset to factory defaults
```

## Troubleshooting

### "No water detected" message
- Ensure the tank has water (tank level > 0.5%)
- Check that the ultrasonic sensor is working

### "Sensor not recognized" message
- Check sensor wiring connections
- Verify the sensor is properly connected to the ESP32
- Check the Sensor Recognition panel for details

### Calibration not saving
- Ensure the ESP32 has write access to the SD card
- Check that the `data/` directory exists and is writable

## Calibration File Location

Calibration values are stored in:
- `data/calibration.json` - Current calibration state
- `data/calibration-history.json` - History of calibration actions

## Resetting Calibration

To reset all calibration values to defaults:
1. Go to the **System** tab in the Calibration panel
2. Click **Reset to Defaults**
3. Confirm the reset

Alternatively, use the serial command `cal reset` on the ESP32.