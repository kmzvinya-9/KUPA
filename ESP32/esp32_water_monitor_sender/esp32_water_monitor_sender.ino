#if __has_include(<time.h>)
#include <time.h>
#elif __has_include(<ctime>)
#include <ctime>
#elif __has_include(<sys/time.h>)
#include <sys/time.h>
#endif
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <SPI.h>
#include <SD.h>
#include <Preferences.h>
#include <math.h>

// =========================
// Wi-Fi / Dashboard config (from secrets.h)
// =========================
#include "secrets.h"

// =========================
// Pin mapping
// =========================
constexpr int PIN_SD_CS = 5;
constexpr int PIN_SD_MOSI = 23;
constexpr int PIN_SD_MISO = 19;
constexpr int PIN_SD_SCK = 18;

constexpr int PIN_LCD_SDA = 21;
constexpr int PIN_LCD_SCL = 22;

constexpr int PIN_DS18B20 = 13;
constexpr int PIN_PH = 32;
constexpr int PIN_TURBIDITY = 34;
constexpr int PIN_FLOW = 33;
constexpr int PIN_ULTRASONIC_TRIG = 17;
constexpr int PIN_ULTRASONIC_ECHO = 16;

constexpr int PIN_TCS_S0 = 2;
constexpr int PIN_TCS_S1 = 15;
constexpr int PIN_TCS_S2 = 27;
constexpr int PIN_TCS_S3 = 4;
constexpr int PIN_TCS_OUT = 25;

// =========================
// Hardware constants
// =========================
constexpr float TANK_LENGTH_CM = 28.0f;
constexpr float TANK_WIDTH_CM = 19.0f;
constexpr float TANK_TOTAL_HEIGHT_CM = 13.0f;
constexpr float TANK_MAX_WATER_HEIGHT_CM = 10.0f;  // Maximum water height is 10cm (not 13cm)
constexpr float TANK_USABLE_CAPACITY_L = 5.0f;      // 5L capacity
constexpr float FLOW_HZ_PER_L_MIN = 7.5f;
constexpr uint32_t POST_INTERVAL_MS = 500;          // 500ms live sampling with SD fallback
constexpr uint32_t TANK_SCAN_INTERVAL_MS = 50;      // Tank level scanned every 50ms for fast detection
constexpr uint32_t LCD_CYCLE_INTERVAL_MS = 1500;    // LCD cycles through readings every 1.5 seconds
constexpr uint32_t WIFI_RETRY_MS = 5000;            // Non-blocking WiFi retry cadence
constexpr uint32_t DASHBOARD_RETRY_MS = 3000;       // Avoid blocking every loop when dashboard is down
constexpr uint32_t QUEUE_FLUSH_INTERVAL_MS = 250;   // Small SD upload slices keep readings responsive
constexpr uint8_t QUEUE_FLUSH_MAX_RECORDS = 3;
constexpr uint16_t HTTP_TIMEOUT_MS = 900;
constexpr float ADC_VREF = 3.3f;
constexpr float TURBIDITY_VREF = 3.3f;
constexpr float TURBIDITY_CLEAR_V = TURBIDITY_VREF;
constexpr float TURBIDITY_DIRTY_V = 0.0f;
constexpr float TEMPERATURE_OFFSET_C = 0.0f;
constexpr float PH_VOLTAGE_THRESHOLD = 0.15f;
constexpr float PH_SLOPE = -5.70f;
constexpr float PH_NEUTRAL_DEFAULT = 7.0f;
constexpr float PH_AUTO_CALIBRATION_ALPHA = 0.02f;
constexpr float PH_STABLE_DELTA = 0.12f;
constexpr uint8_t ULTRASONIC_BURST_SAMPLES = 5;
constexpr unsigned long ULTRASONIC_TIMEOUT_US = 5000UL;
constexpr float ULTRASONIC_SMOOTHING_ALPHA = 0.85f;
constexpr unsigned long COLOR_PULSE_TIMEOUT_US = 25000UL;
constexpr float COLOR_BASELINE_ALPHA = 0.02f;
constexpr int COLOR_BALANCE_TOLERANCE = 24;
constexpr int COLOR_BASELINE_MIN = 40;
constexpr uint32_t SERIAL_BAUD_RATE = 115200;
const char* SD_LOG_FILE = "/water_log.csv";
const char* SD_QUEUE_FILE = "/pending_queue.jsonl";

volatile uint32_t flowPulses = 0;

LiquidCrystal_I2C lcd(0x27, 16, 2);
OneWire oneWire(PIN_DS18B20);
DallasTemperature ds18b20(&oneWire);
Preferences preferences;

struct Reading {
  bool hasWater;
  float temperatureC;
  float ph;
  float turbidityPercent;
  float flowRateLMin;
  float tankLevelPercent;
  float tankCapacity;
  int colorR;
  int colorG;
  int colorB;
  int lux;
  uint32_t pulseCount;
  bool sdCardActive;
  bool sdCardWriting;
  float sdCardUsage;
  uint32_t uptimeSeconds;
  uint32_t pendingQueueCount;
  bool temperatureSensorOk;
  bool phSensorOk;
  bool turbiditySensorOk;
  bool ultrasonicSensorOk;
  bool colorSensorOk;
  float phVoltage;
  float turbidityVoltage;
  const char* flowSensorState;
};

Reading latestReading{};
bool sdReady = false;
uint32_t lastPostMs = 0;
uint32_t lastLcdMs = 0;
uint32_t lastTankScanMs = 0;
uint32_t lastWifiAttemptMs = 0;
uint32_t lastDashboardAttemptMs = 0;
uint32_t lastQueueFlushMs = 0;
uint8_t lcdCycleIndex = 0;
bool tankScanTriggered = false;
bool wifiConnectStarted = false;
bool dashboardReachable = false;
float phCalibrationOffset = PH_NEUTRAL_DEFAULT;
float smoothedPh = 0.0f;
bool phFirstReading = true;
float lastStablePh = PH_NEUTRAL_DEFAULT;
float turbidityClearVoltage = TURBIDITY_CLEAR_V;
float turbidityDirtyVoltage = TURBIDITY_DIRTY_V;
float lastDistanceCm = TANK_TOTAL_HEIGHT_CM;
bool ultrasonicHasLastValue = false;
float colorBaselineR = 255.0f;
float colorBaselineG = 255.0f;
float colorBaselineB = 255.0f;
bool colorBaselineReady = false;
uint32_t pendingQueueCount = 0;
uint32_t pendingQueueOffset = 0;
uint32_t recordCounter = 0;
uint32_t bootId = 0;

void readRawColorSensor(int &r, int &g, int &b, bool &sensorOk);

void IRAM_ATTR onFlowPulse() {
  flowPulses++;
}

float clampf(float value, float minValue, float maxValue) {
  return min(maxValue, max(minValue, value));
}

float readPhVoltage(int pin) {
  const int bufferSize = 20;
  int buffer[bufferSize];
  int temp;
  unsigned long avgVal = 0;

  for (int i = 0; i < bufferSize; i++) {
    buffer[i] = analogRead(pin);
    delay(2);
  }

  for (int i = 0; i < bufferSize - 1; i++) {
    for (int j = i + 1; j < bufferSize; j++) {
      if (buffer[i] > buffer[j]) {
        temp = buffer[i];
        buffer[i] = buffer[j];
        buffer[j] = temp;
      }
    }
  }

  for (int i = 5; i < 15; i++) {
    avgVal += buffer[i];
  }

  return ((avgVal / 10.0) * ADC_VREF) / 4095.0f;
}

float readTrimmedAnalogVoltage(int pin, int sampleCount = 12, int sampleDelayMs = 1) {
  const int maxSamples = 15;
  int values[maxSamples];
  sampleCount = constrain(sampleCount, 5, maxSamples);

  for (int i = 0; i < sampleCount; i++) {
    values[i] = analogRead(pin);
    delay(sampleDelayMs);
  }

  for (int i = 0; i < sampleCount - 1; i++) {
    for (int j = i + 1; j < sampleCount; j++) {
      if (values[j] < values[i]) {
        int tmp = values[i];
        values[i] = values[j];
        values[j] = tmp;
      }
    }
  }

  int discard = sampleCount / 4;
  int start = discard;
  int end = sampleCount - discard;
  unsigned long total = 0;
  int used = 0;

  for (int i = start; i < end; i++) {
    total += values[i];
    used++;
  }

  if (used == 0) return 0.0f;
  return ((total / (float)used) * ADC_VREF) / 4095.0f;
}

void initializePhAutoCalibration() {
  phCalibrationOffset = PH_NEUTRAL_DEFAULT;
  smoothedPh = PH_NEUTRAL_DEFAULT;
  lastStablePh = PH_NEUTRAL_DEFAULT;
  phFirstReading = true;
  Serial.println("pH adaptive baseline enabled.");
}

void calibratePhNeutral(float voltage) {
  phCalibrationOffset = PH_NEUTRAL_DEFAULT - (PH_SLOPE * voltage);
  smoothedPh = PH_NEUTRAL_DEFAULT;
  lastStablePh = PH_NEUTRAL_DEFAULT;
  phFirstReading = true;
}

void updatePhAutoCalibration(float voltage, float measuredPh, bool hasWater, bool sensorOk) {
  if (!sensorOk || !hasWater) return;

  if (fabs(measuredPh - lastStablePh) > PH_STABLE_DELTA) {
    lastStablePh = measuredPh;
    return;
  }

  const float targetOffset = PH_NEUTRAL_DEFAULT - (PH_SLOPE * voltage);
  phCalibrationOffset = ((1.0f - PH_AUTO_CALIBRATION_ALPHA) * phCalibrationOffset) + (PH_AUTO_CALIBRATION_ALPHA * targetOffset);
  lastStablePh = ((1.0f - PH_AUTO_CALIBRATION_ALPHA) * lastStablePh) + (PH_AUTO_CALIBRATION_ALPHA * measuredPh);
}

void initializeTurbidityCalibration() {
  turbidityClearVoltage = TURBIDITY_CLEAR_V;
  turbidityDirtyVoltage = TURBIDITY_DIRTY_V;
}

void calibrateTurbidityClear(float voltage) {
  turbidityClearVoltage = clampf(voltage, 0.0f, TURBIDITY_VREF);
  if (turbidityClearVoltage <= turbidityDirtyVoltage) {
    turbidityDirtyVoltage = max(0.0f, turbidityClearVoltage - 0.1f);
  }
}

void calibrateTurbidityDirty(float voltage) {
  turbidityDirtyVoltage = clampf(voltage, 0.0f, TURBIDITY_VREF);
  if (turbidityDirtyVoltage >= turbidityClearVoltage) {
    turbidityClearVoltage = min(TURBIDITY_VREF, turbidityDirtyVoltage + 0.1f);
  }
}

void initializeColorCalibration() {
  colorBaselineR = 255.0f;
  colorBaselineG = 255.0f;
  colorBaselineB = 255.0f;
  colorBaselineReady = false;
}

void saveCalibrationState() {
  if (!preferences.begin("watercal", false)) {
    Serial.println("Calibration save skipped.");
    return;
  }

  preferences.putFloat("phOffset", phCalibrationOffset);
  preferences.putFloat("turbClr", turbidityClearVoltage);
  preferences.putFloat("turbDrt", turbidityDirtyVoltage);
  preferences.putFloat("colBaseR", colorBaselineR);
  preferences.putFloat("colBaseG", colorBaselineG);
  preferences.putFloat("colBaseB", colorBaselineB);
  preferences.putBool("colReady", colorBaselineReady);
  preferences.end();
}

void loadCalibrationState() {
  if (!preferences.begin("watercal", true)) {
    Serial.println("Calibration load skipped.");
    return;
  }

  phCalibrationOffset = preferences.getFloat("phOffset", phCalibrationOffset);
  turbidityClearVoltage = preferences.getFloat("turbClr", turbidityClearVoltage);
  turbidityDirtyVoltage = preferences.getFloat("turbDrt", turbidityDirtyVoltage);
  colorBaselineR = preferences.getFloat("colBaseR", colorBaselineR);
  colorBaselineG = preferences.getFloat("colBaseG", colorBaselineG);
  colorBaselineB = preferences.getFloat("colBaseB", colorBaselineB);
  colorBaselineReady = preferences.getBool("colReady", colorBaselineReady);
  preferences.end();

  if (turbidityClearVoltage <= turbidityDirtyVoltage) {
    turbidityClearVoltage = max(turbidityDirtyVoltage + 0.1f, turbidityClearVoltage);
  }
}

void calibrateColorBaselineNow(int rawR, int rawG, int rawB) {
  colorBaselineR = rawR;
  colorBaselineG = rawG;
  colorBaselineB = rawB;
  colorBaselineReady = true;
}

void updateColorBaseline(int rawR, int rawG, int rawB, bool hasWater, bool sensorOk) {
  if (!sensorOk || !hasWater) return;

  const int maxChannel = max(rawR, max(rawG, rawB));
  const int minChannel = min(rawR, min(rawG, rawB));
  const int avgChannel = (rawR + rawG + rawB) / 3;
  const bool looksNeutral = (maxChannel - minChannel) <= COLOR_BALANCE_TOLERANCE && avgChannel >= COLOR_BASELINE_MIN;

  if (!looksNeutral) return;

  if (!colorBaselineReady) {
    colorBaselineR = rawR;
    colorBaselineG = rawG;
    colorBaselineB = rawB;
    colorBaselineReady = true;
    return;
  }

  colorBaselineR = ((1.0f - COLOR_BASELINE_ALPHA) * colorBaselineR) + (COLOR_BASELINE_ALPHA * rawR);
  colorBaselineG = ((1.0f - COLOR_BASELINE_ALPHA) * colorBaselineG) + (COLOR_BASELINE_ALPHA * rawG);
  colorBaselineB = ((1.0f - COLOR_BASELINE_ALPHA) * colorBaselineB) + (COLOR_BASELINE_ALPHA * rawB);
}

int normalizeColorChannel(int rawValue, float baselineValue) {
  if (baselineValue < 1.0f) return constrain(rawValue, 0, 255);
  return constrain((int)roundf((rawValue * 255.0f) / baselineValue), 0, 255);
}

void printCalibrationStatus() {
  Serial.println("=== Calibration Status ===");
  Serial.printf("Tank usable height: %.2f cm\n", TANK_MAX_WATER_HEIGHT_CM);
  Serial.printf("Tank capacity: %.2f L\n", TANK_USABLE_CAPACITY_L);
  Serial.printf("pH offset: %.4f\n", phCalibrationOffset);
  Serial.printf("Turbidity clear V: %.3f | dirty V: %.3f\n", turbidityClearVoltage, turbidityDirtyVoltage);
  Serial.printf("Color baseline: R %.1f | G %.1f | B %.1f | ready=%d\n", colorBaselineR, colorBaselineG, colorBaselineB, colorBaselineReady ? 1 : 0);
}

void printCalibrationHelp() {
  Serial.println("Calibration commands:");
  Serial.println("  help");
  Serial.println("  status");
  Serial.println("  cal all");
  Serial.println("  cal ph7");
  Serial.println("  cal turbidity-clear");
  Serial.println("  cal turbidity-dirty");
  Serial.println("  cal color");
  Serial.println("  cal reset");
}

void handleCalibrationCommand(String command) {
  command.trim();
  command.toLowerCase();
  if (command.length() == 0) return;

  if (command == "help") {
    printCalibrationHelp();
    return;
  }

  if (command == "status") {
    printCalibrationStatus();
    return;
  }

  if (command == "cal reset") {
    initializePhAutoCalibration();
    initializeTurbidityCalibration();
    initializeColorCalibration();
    saveCalibrationState();
    Serial.println("Calibration state reset to defaults.");
    printCalibrationStatus();
    return;
  }

  if (command == "cal ph7" || command == "cal all") {
    if (latestReading.hasWater && latestReading.phSensorOk) {
      calibratePhNeutral(latestReading.phVoltage);
      saveCalibrationState();
      Serial.printf("pH baseline captured at %.3f V\n", latestReading.phVoltage);
    } else {
      Serial.println("pH calibration skipped.");
    }
  }

  if (command == "cal turbidity-clear" || command == "cal all") {
    if (latestReading.hasWater && latestReading.turbiditySensorOk) {
      calibrateTurbidityClear(latestReading.turbidityVoltage);
      saveCalibrationState();
      Serial.printf("Turbidity clear baseline: %.3f V\n", latestReading.turbidityVoltage);
    } else {
      Serial.println("Turbidity clear calibration skipped.");
    }
  }

  if (command == "cal turbidity-dirty") {
    if (latestReading.hasWater && latestReading.turbiditySensorOk) {
      calibrateTurbidityDirty(latestReading.turbidityVoltage);
      saveCalibrationState();
      Serial.printf("Turbidity dirty baseline: %.3f V\n", latestReading.turbidityVoltage);
    } else {
      Serial.println("Turbidity dirty calibration skipped.");
    }
  }

  if (command == "cal color" || command == "cal all") {
    bool colorOk = false;
    int rawR = 0;
    int rawG = 0;
    int rawB = 0;
    readRawColorSensor(rawR, rawG, rawB, colorOk);
    if (latestReading.hasWater && colorOk) {
      calibrateColorBaselineNow(rawR, rawG, rawB);
      saveCalibrationState();
      Serial.printf("Color baseline: R %d | G %d | B %d\n", rawR, rawG, rawB);
    } else {
      Serial.println("Color calibration skipped.");
    }
  }

  if (command != "help" && command != "status" && command != "cal all" && command != "cal ph7" && command != "cal turbidity-clear" && command != "cal turbidity-dirty" && command != "cal color" && command != "cal reset") {
    Serial.println("Unknown command.");
    printCalibrationHelp();
    return;
  }

  printCalibrationStatus();
}

float readTemperatureC(bool &sensorOk) {
  float total = 0.0f;
  int ok = 0;

  ds18b20.requestTemperatures();
  delay(50);
  
  for (int i = 0; i < 2; i++) {
    float temp = ds18b20.getTempCByIndex(0);
    if (temp != DEVICE_DISCONNECTED_C && temp > -50.0f && temp < 125.0f) {
      total += temp;
      ok++;
    }
    delay(5);
  }

  sensorOk = ok > 0;
  if (!sensorOk) return 0.0f;
  return (total / ok) + TEMPERATURE_OFFSET_C;
}

float readPh(bool &sensorOk, float &voltageOut) {
  voltageOut = readPhVoltage(PIN_PH);
  sensorOk = voltageOut >= PH_VOLTAGE_THRESHOLD;
  if (!sensorOk) {
    phFirstReading = true;
    smoothedPh = 0.0f;
    return 0.0f;
  }

  float rawPh = (PH_SLOPE * voltageOut) + phCalibrationOffset;
  rawPh = clampf(rawPh, 0.0f, 14.0f);

  if (phFirstReading) {
    smoothedPh = rawPh;
    phFirstReading = false;
  } else {
    smoothedPh = (0.2f * rawPh) + (0.8f * smoothedPh);
  }

  return clampf(smoothedPh, 0.0f, 14.0f);
}

float readTurbidityPercent(bool &sensorOk, float &voltageOut) {
  voltageOut = readTrimmedAnalogVoltage(PIN_TURBIDITY, 12, 1);
  sensorOk = voltageOut > 0.02f;
  const float span = max(0.01f, turbidityClearVoltage - turbidityDirtyVoltage);
  float percent = ((voltageOut - turbidityDirtyVoltage) / span) * 100.0f;
  return clampf(percent, 0.0f, 100.0f);
}

float readDistanceSampleCm(bool &sensorOk) {
  digitalWrite(PIN_ULTRASONIC_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_ULTRASONIC_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_ULTRASONIC_TRIG, LOW);

  unsigned long duration = pulseIn(PIN_ULTRASONIC_ECHO, HIGH, ULTRASONIC_TIMEOUT_US);
  sensorOk = duration != 0;
  if (!sensorOk) return TANK_TOTAL_HEIGHT_CM;

  float distanceCm = duration * 0.0343f / 2.0f;
  return clampf(distanceCm, 0.0f, TANK_TOTAL_HEIGHT_CM);
}

float readDistanceCm(bool &sensorOk) {
  float samples[ULTRASONIC_BURST_SAMPLES];
  uint8_t validCount = 0;

  for (uint8_t i = 0; i < ULTRASONIC_BURST_SAMPLES; i++) {
    bool sampleOk = false;
    const float sample = readDistanceSampleCm(sampleOk);
    if (sampleOk) {
      samples[validCount++] = sample;
    }
    delayMicroseconds(30);
  }

  if (validCount == 0) {
    sensorOk = ultrasonicHasLastValue;
    return ultrasonicHasLastValue ? lastDistanceCm : TANK_TOTAL_HEIGHT_CM;
  }

  for (uint8_t i = 0; i < validCount; i++) {
    for (uint8_t j = i + 1; j < validCount; j++) {
      if (samples[j] < samples[i]) {
        const float tmp = samples[i];
        samples[i] = samples[j];
        samples[j] = tmp;
      }
    }
  }

  float distance = samples[validCount / 2];
  if (ultrasonicHasLastValue) {
    distance = (ULTRASONIC_SMOOTHING_ALPHA * distance) + ((1.0f - ULTRASONIC_SMOOTHING_ALPHA) * lastDistanceCm);
  }

  lastDistanceCm = clampf(distance, 0.0f, TANK_TOTAL_HEIGHT_CM);
  ultrasonicHasLastValue = true;
  sensorOk = true;
  return lastDistanceCm;
}

float readTankLevelPercent(bool &sensorOk) {
  float distance = readDistanceCm(sensorOk);
  float waterHeight = TANK_TOTAL_HEIGHT_CM - distance;
  waterHeight = clampf(waterHeight, 0.0f, TANK_MAX_WATER_HEIGHT_CM);
  float percent = (waterHeight / TANK_MAX_WATER_HEIGHT_CM) * 100.0f;
  return clampf(percent, 0.0f, 100.0f);
}

uint32_t readColorPulse(bool s2, bool s3) {
  digitalWrite(PIN_TCS_S2, s2 ? HIGH : LOW);
  digitalWrite(PIN_TCS_S3, s3 ? HIGH : LOW);
  delay(3);
  return pulseIn(PIN_TCS_OUT, LOW, COLOR_PULSE_TIMEOUT_US);
}

int pulseToColor(uint32_t pulse) {
  if (pulse == 0) return 0;
  long mapped = map((long)constrain((int)pulse, 20, 300), 20, 300, 255, 0);
  return constrain((int)mapped, 0, 255);
}

void readRawColorSensor(int &r, int &g, int &b, bool &sensorOk) {
  uint32_t pulseR = readColorPulse(LOW, LOW);
  uint32_t pulseG = readColorPulse(HIGH, HIGH);
  uint32_t pulseB = readColorPulse(LOW, HIGH);

  sensorOk = pulseR > 0 || pulseG > 0 || pulseB > 0;
  r = pulseToColor(pulseR);
  g = pulseToColor(pulseG);
  b = pulseToColor(pulseB);
}

void readColorSensor(int &r, int &g, int &b, int &lux, bool &sensorOk, bool hasWater) {
  int rawR = 0;
  int rawG = 0;
  int rawB = 0;
  readRawColorSensor(rawR, rawG, rawB, sensorOk);

  updateColorBaseline(rawR, rawG, rawB, hasWater, sensorOk);

  r = colorBaselineReady ? normalizeColorChannel(rawR, colorBaselineR) : rawR;
  g = colorBaselineReady ? normalizeColorChannel(rawG, colorBaselineG) : rawG;
  b = colorBaselineReady ? normalizeColorChannel(rawB, colorBaselineB) : rawB;
  lux = constrain((r + g + b) / 3, 0, 255) * 4;
}

float pulsesToFlowRateLMin(uint32_t pulses, uint32_t sampleWindowMs) {
  if (sampleWindowMs == 0) return 0.0f;
  const float frequencyHz = (pulses * 1000.0f) / sampleWindowMs;
  return clampf(frequencyHz / FLOW_HZ_PER_L_MIN, 0.0f, 200.0f);
}

float computeSdUsagePercent() {
  if (!sdReady) return 0.0f;
  uint64_t totalBytes = SD.totalBytes();
  uint64_t usedBytes = SD.usedBytes();
  if (totalBytes == 0) return 0.0f;
  return (usedBytes * 100.0f) / totalBytes;
}

bool isDashboardOnline() {
  return WiFi.status() == WL_CONNECTED && dashboardReachable;
}

bool shouldAttemptDashboardNow() {
  if (WiFi.status() != WL_CONNECTED) {
    dashboardReachable = false;
    return false;
  }

  if (dashboardReachable) return true;
  if (lastDashboardAttemptMs == 0) return true;
  return millis() - lastDashboardAttemptMs >= DASHBOARD_RETRY_MS;
}

void ensureWiFiConnected() {
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnectStarted = false;
    return;
  }

  dashboardReachable = false;

  if (millis() - lastWifiAttemptMs < WIFI_RETRY_MS && lastWifiAttemptMs != 0) {
    return;
  }

  lastWifiAttemptMs = millis();
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  wifiConnectStarted = true;
  Serial.println("WiFi connect attempt started.");
}

void zeroReading(Reading &r) {
  r.hasWater = false;
  r.temperatureC = 0.0f;
  r.ph = 0.0f;
  r.turbidityPercent = 0.0f;
  r.flowRateLMin = 0.0f;
  r.tankLevelPercent = 0.0f;
  r.colorR = 0;
  r.colorG = 0;
  r.colorB = 0;
  r.lux = 0;
  r.pulseCount = 0;
  r.phVoltage = 0.0f;
  r.turbidityVoltage = 0.0f;
  r.flowSensorState = "no_water";
}


String buildTimestamp() {
  time_t now = time(nullptr);
  if (now > 1700000000) {
    return String((uint32_t)now);
  }
  return String((uint32_t)(millis() / 1000UL));
}

String buildRecordId() {
  recordCounter++;
  String id = String(DEVICE_ID);
  id += "-";
  id += String(bootId);
  id += "-";
  id += String(recordCounter);
  return id;
}

void buildTelemetryPayload(const Reading &r, const String &timestamp, const String &recordId, String &bodyOut) {
  JsonDocument doc;
  doc["recordId"] = recordId;
  doc["deviceId"] = DEVICE_ID;
  doc["apiKey"] = API_KEY;
  doc["timestamp"] = timestamp;
  doc["hasWater"] = r.hasWater;
  doc["temperatureC"] = r.temperatureC;
  doc["ph"] = r.ph;
  doc["turbidityPercent"] = r.turbidityPercent;
  doc["flowRateLMin"] = r.flowRateLMin;
  doc["tankLevelPercent"] = r.tankLevelPercent;
  doc["tankCapacity"] = r.tankCapacity;
  doc["colorR"] = r.colorR;
  doc["colorG"] = r.colorG;
  doc["colorB"] = r.colorB;
  doc["lux"] = r.lux;
  doc["pulseCount"] = r.pulseCount;
  doc["sdCardActive"] = r.sdCardActive;
  doc["sdCardWriting"] = r.sdCardWriting;
  doc["sdCardUsage"] = r.sdCardUsage;
  doc["uptimeSeconds"] = r.uptimeSeconds;
  doc["pendingQueueCount"] = r.pendingQueueCount;
  doc["temperatureSensorOk"] = r.temperatureSensorOk;
  doc["phSensorOk"] = r.phSensorOk;
  doc["turbiditySensorOk"] = r.turbiditySensorOk;
  doc["ultrasonicSensorOk"] = r.ultrasonicSensorOk;
  doc["colorSensorOk"] = r.colorSensorOk;
  doc["phVoltage"] = r.phVoltage;
  doc["turbidityVoltage"] = r.turbidityVoltage;
  doc["flowSensorState"] = r.flowSensorState;

  // Clear output string first
  bodyOut = "";
  
  // Serialize JSON
  size_t jsonSize = serializeJson(doc, bodyOut);
  
  // Debug: Log payload size and first few bytes
  if (jsonSize == 0) {
    Serial.println("WARNING: JSON serialization produced empty output");
  } else if (bodyOut.length() == 0) {
    Serial.println("WARNING: bodyOut string is empty after serialization");
  } else {
    // Log payload preview for debugging (first 100 chars)
    Serial.printf("[PAYLOAD] Size: %d bytes, Preview: %.100s\n", jsonSize, bodyOut.c_str());
  }
}

bool sendPayloadToDashboard(const String &body) {
  if (WiFi.status() != WL_CONNECTED) {
    dashboardReachable = false;
    return false;
  }

  // Validate payload before sending
  if (body.length() == 0) {
    Serial.println("ERROR: Empty payload, skipping send");
    return false;
  }

  // Check for valid JSON structure (must start with { and end with })
  String trimmed = body;
  trimmed.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    Serial.println("ERROR: Invalid JSON structure, skipping send");
    Serial.printf("Payload preview: %.80s\n", body.c_str());
    return false;
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", API_KEY);

  lastDashboardAttemptMs = millis();
  int statusCode = http.POST(body);
  String response = http.getString();
  Serial.printf("POST /api/ingest -> %d\n", statusCode);
  if (response.length() > 0) {
    Serial.println(response);
  }
  http.end();
  dashboardReachable = statusCode >= 200 && statusCode < 300;
  return dashboardReachable;
}

uint32_t countPendingQueueRecords() {
  if (!sdReady || !SD.exists(SD_QUEUE_FILE)) return 0;

  File f = SD.open(SD_QUEUE_FILE, FILE_READ);
  if (!f) return 0;

  uint32_t count = 0;
  while (f.available()) {
    String line = f.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) count++;
  }
  f.close();
  return count;
}

// SD-backed pending queue for readings that could not reach the dashboard.
bool enqueuePayloadToSd(const String &body) {
  if (!sdReady) return false;
  if (body.length() == 0) return false;

  const bool queueExisted = SD.exists(SD_QUEUE_FILE);
  File f = SD.open(SD_QUEUE_FILE, FILE_APPEND);
  if (!f) return false;
  f.println(body);
  f.close();

  if (!queueExisted) {
    pendingQueueOffset = 0;
  }
  pendingQueueCount++;
  return true;
}

void clearPendingQueueIfComplete(size_t queueFileSize) {
  if (pendingQueueOffset < queueFileSize) return;

  SD.remove(SD_QUEUE_FILE);
  pendingQueueOffset = 0;
  pendingQueueCount = 0;
  latestReading.pendingQueueCount = 0;
  Serial.println("SD pending queue uploaded.");
}

void tryFlushPendingQueue() {
  if (!sdReady) return;
  if (pendingQueueCount == 0) return;
  if (!SD.exists(SD_QUEUE_FILE)) {
    pendingQueueOffset = 0;
    pendingQueueCount = 0;
    return;
  }
  if (!shouldAttemptDashboardNow()) return;
  if (millis() - lastQueueFlushMs < QUEUE_FLUSH_INTERVAL_MS && lastQueueFlushMs != 0) {
    return;
  }

  lastQueueFlushMs = millis();

  File src = SD.open(SD_QUEUE_FILE, FILE_READ);
  if (!src) return;

  const size_t queueFileSize = src.size();
  if (pendingQueueOffset >= queueFileSize) {
    src.close();
    clearPendingQueueIfComplete(queueFileSize);
    return;
  }

  src.seek(pendingQueueOffset);

  uint8_t sentThisPass = 0;
  while (src.available() && sentThisPass < QUEUE_FLUSH_MAX_RECORDS) {
    const size_t lineStart = src.position();
    String line = src.readStringUntil('\n');
    const size_t lineEnd = src.position();
    line.trim();

    if (line.length() == 0) {
      pendingQueueOffset = lineEnd;
      continue;
    }

    if (!line.startsWith("{") || !line.endsWith("}")) {
      Serial.println("WARNING: Dropping corrupt SD queue line");
      pendingQueueOffset = lineEnd;
      if (pendingQueueCount > 0) pendingQueueCount--;
      latestReading.pendingQueueCount = pendingQueueCount;
      continue;
    }

    if (!sendPayloadToDashboard(line)) {
      pendingQueueOffset = lineStart;
      break;
    }

    pendingQueueOffset = lineEnd;
    if (pendingQueueCount > 0) pendingQueueCount--;
    latestReading.pendingQueueCount = pendingQueueCount;
    sentThisPass++;
  }

  src.close();
  clearPendingQueueIfComplete(queueFileSize);
}


void collectNonTankReadings(Reading &r, uint32_t sampleWindowMs) {
  r.uptimeSeconds = millis() / 1000UL;
  r.pendingQueueCount = pendingQueueCount;
  r.sdCardActive = sdReady;
  r.sdCardWriting = false;
  r.sdCardUsage = computeSdUsagePercent();
  r.tankCapacity = TANK_USABLE_CAPACITY_L;

  r.hasWater = r.tankLevelPercent > 0.5f;

  noInterrupts();
  uint32_t pulses = flowPulses;
  flowPulses = 0;
  interrupts();

  if (!r.hasWater) {
    r.temperatureSensorOk = true;
    r.phSensorOk = true;
    r.turbiditySensorOk = true;
    r.colorSensorOk = true;
    zeroReading(r);
    r.sdCardActive = sdReady;
    r.sdCardUsage = computeSdUsagePercent();
    r.uptimeSeconds = millis() / 1000UL;
    r.pendingQueueCount = pendingQueueCount;
    r.tankLevelPercent = 0;
    r.hasWater = false;
    return;
  }

  r.temperatureC = readTemperatureC(r.temperatureSensorOk);
  r.ph = readPh(r.phSensorOk, r.phVoltage);
  updatePhAutoCalibration(r.phVoltage, r.ph, r.hasWater, r.phSensorOk);
  r.turbidityPercent = readTurbidityPercent(r.turbiditySensorOk, r.turbidityVoltage);
  r.flowRateLMin = pulsesToFlowRateLMin(pulses, sampleWindowMs);
  r.pulseCount = pulses;
  r.flowSensorState = r.flowRateLMin > 0.2f ? "active" : "idle";
  readColorSensor(r.colorR, r.colorG, r.colorB, r.lux, r.colorSensorOk, r.hasWater);
}

Reading collectReading(uint32_t sampleWindowMs) {
  Reading r{};
  r.tankLevelPercent = latestReading.tankLevelPercent;
  r.ultrasonicSensorOk = latestReading.ultrasonicSensorOk;
  r.hasWater = latestReading.hasWater;
  
  collectNonTankReadings(r, sampleWindowMs);
  return r;
}

void logToSd(const Reading &r, const String &timestamp, const String &recordId) {
  if (!sdReady) return;

  File file = SD.open(SD_LOG_FILE, FILE_APPEND);
  if (!file) return;

  latestReading.sdCardWriting = true;
  if (file.size() == 0) {
    file.println("recordId,timestamp,hasWater,tempC,ph,phVoltage,turbidityPct,turbidityVoltage,flowLMin,tankPct,colorR,colorG,colorB,lux,pulseCount,pendingQueueCount");
  }
  file.printf(
    "%s,%s,%d,%.2f,%.2f,%.3f,%.2f,%.3f,%.2f,%.2f,%d,%d,%d,%d,%lu,%u\n",
    recordId.c_str(),
    timestamp.c_str(),
    r.hasWater ? 1 : 0,
    r.temperatureC,
    r.ph,
    r.phVoltage,
    r.turbidityPercent,
    r.turbidityVoltage,
    r.flowRateLMin,
    r.tankLevelPercent,
    r.colorR,
    r.colorG,
    r.colorB,
    r.lux,
    static_cast<unsigned long>(r.pulseCount),
    r.pendingQueueCount
  );
  file.close();
  latestReading.sdCardWriting = false;
}

void printLcdQueueCount(uint32_t count) {
  const uint32_t shown = count > 9999UL ? 9999UL : count;
  lcd.printf("%4lu", static_cast<unsigned long>(shown));
}

void updateLcd(const Reading &r, uint8_t cycleIndex) {
  lcd.clear();

  float volumeL = r.tankCapacity * (r.tankLevelPercent / 100.0f);

  if (!isDashboardOnline()) {
    lcd.setCursor(0, 0);
    lcd.print("OFFLINE SD:");
    printLcdQueueCount(pendingQueueCount);

    lcd.setCursor(0, 1);
    switch (cycleIndex % 3) {
      case 0:
        lcd.printf("T:%2.1fC pH:%2.1f", r.temperatureC, r.ph);
        break;
      case 1:
        lcd.printf("Tur:%2.0f%% F:%2.1f", r.turbidityPercent, r.flowRateLMin);
        break;
      default:
        lcd.printf("Lv:%2.0f%% V:%.1fL", r.tankLevelPercent, volumeL);
        break;
    }
    return;
  }

  if (pendingQueueCount > 0) {
    lcd.setCursor(0, 0);
    lcd.print("SYNC SD:");
    printLcdQueueCount(pendingQueueCount);
    lcd.setCursor(0, 1);
    lcd.printf("T:%2.1f pH:%2.1f", r.temperatureC, r.ph);
    return;
  }

  lcd.setCursor(0, 1);
  lcd.printf("Lv:%2.0f%% Vol:%.1fL", r.tankLevelPercent, volumeL);

  if (r.flowRateLMin > 0.2f) {
    lcd.setCursor(0, 0);
    lcd.printf("Flow:%2.1fL/m", r.flowRateLMin);
    return;
  }

  switch (cycleIndex % 2) {
    case 0:
      lcd.setCursor(0, 0);
      lcd.printf("Temp:%2.1fC pH:%2.1f", r.temperatureC, r.ph);
      break;

    case 1:
      lcd.setCursor(0, 0);
      lcd.printf("Tur:%2.0f%% R:%d", r.turbidityPercent, r.colorR);
      break;
  }
}

void setup() {
  Serial.begin(SERIAL_BAUD_RATE);
  delay(100);

  bootId = (uint32_t)esp_random();

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  analogSetPinAttenuation(PIN_PH, ADC_11db);
  analogSetPinAttenuation(PIN_TURBIDITY, ADC_11db);

  pinMode(PIN_ULTRASONIC_TRIG, OUTPUT);
  pinMode(PIN_ULTRASONIC_ECHO, INPUT);
  pinMode(PIN_FLOW, INPUT_PULLUP);

  pinMode(PIN_TCS_S0, OUTPUT);
  pinMode(PIN_TCS_S1, OUTPUT);
  pinMode(PIN_TCS_S2, OUTPUT);
  pinMode(PIN_TCS_S3, OUTPUT);
  pinMode(PIN_TCS_OUT, INPUT);

  digitalWrite(PIN_TCS_S0, HIGH);
  digitalWrite(PIN_TCS_S1, LOW);
  digitalWrite(PIN_TCS_S2, LOW);
  digitalWrite(PIN_TCS_S3, LOW);

  attachInterrupt(digitalPinToInterrupt(PIN_FLOW), onFlowPulse, FALLING);

  Wire.begin(PIN_LCD_SDA, PIN_LCD_SCL);
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Water Monitor");
  lcd.setCursor(0, 1);
  lcd.print("Booting...");

  ds18b20.begin();
  ds18b20.setResolution(10);

  SPI.begin(PIN_SD_SCK, PIN_SD_MISO, PIN_SD_MOSI, PIN_SD_CS);
  sdReady = SD.begin(PIN_SD_CS);
  pendingQueueCount = countPendingQueueRecords();
  latestReading.pendingQueueCount = pendingQueueCount;

  WiFi.persistent(false);
  ensureWiFiConnected();
  configTime(2 * 3600, 0, "pool.ntp.org", "time.nist.gov");  // SAST = UTC+2 (South Africa)
  initializePhAutoCalibration();
  initializeTurbidityCalibration();
  initializeColorCalibration();
  loadCalibrationState();

  Serial.println("Setup complete.");
  Serial.printf("SD queue pending: %lu\n", static_cast<unsigned long>(pendingQueueCount));
  Serial.println("Change SERVER_URL to your PC LAN IP before uploading.");
  printCalibrationHelp();
}

void loop() {
  ensureWiFiConnected();

  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    handleCalibrationCommand(command);
  }

  uint32_t now = millis();

  // Tank level scanning every 50ms (faster real-time response)
  if (now - lastTankScanMs >= TANK_SCAN_INTERVAL_MS || lastTankScanMs == 0) {
    lastTankScanMs = now;
    
    bool ultrasonicOk = false;
    float tankLevel = readTankLevelPercent(ultrasonicOk);
    latestReading.tankLevelPercent = tankLevel;
    latestReading.ultrasonicSensorOk = ultrasonicOk;
    latestReading.hasWater = tankLevel > 0.5f;
    latestReading.uptimeSeconds = now / 1000UL;
    
    // Only trigger LCD cycle reset once per tank scan cycle (not continuously)
    if (!tankScanTriggered) {
      tankScanTriggered = true;
      lcdCycleIndex = 0;  // Reset cycle index only once when scan triggers
    }
    
    Serial.printf("[TANK SCAN] Level: %.1f%% | Water: %s\n", 
                  tankLevel, latestReading.hasWater ? "YES" : "NO");
  }

  // Telemetry sampling and upload. Offline/dashboard failures are written to SD.
  if (now - lastPostMs >= POST_INTERVAL_MS || lastPostMs == 0) {
    const uint32_t sampleWindowMs = lastPostMs == 0 ? POST_INTERVAL_MS : (now - lastPostMs);
    lastPostMs = now;
    
    latestReading = collectReading(sampleWindowMs);

    String timestamp = buildTimestamp();
    String recordId = buildRecordId();
    latestReading.pendingQueueCount = pendingQueueCount;

    logToSd(latestReading, timestamp, recordId);

    // Backlog is uploaded first. Live records wait in SD until old records are drained.
    if (pendingQueueCount > 0) {
      tryFlushPendingQueue();
    }

    String payload;
    buildTelemetryPayload(latestReading, timestamp, recordId, payload);

    bool sent = false;
    if (pendingQueueCount > 0) {
      if (!enqueuePayloadToSd(payload)) {
        Serial.println("WARNING: Failed to enqueue payload to SD");
      }
    } else if (shouldAttemptDashboardNow()) {
      sent = sendPayloadToDashboard(payload);
      if (!sent && !enqueuePayloadToSd(payload)) {
        Serial.println("WARNING: Failed to enqueue payload to SD");
      }
    } else {
      if (!enqueuePayloadToSd(payload)) {
        Serial.println("WARNING: SD not ready - cannot queue payload");
      }
    }

    Serial.println("=== ESP32 Water Reading ===");
    Serial.printf("WiFi: %s\n", WiFi.status() == WL_CONNECTED ? "Connected" : "Disconnected");
    Serial.printf("Dashboard: %s\n", isDashboardOnline() ? "Online" : "Offline");
    Serial.printf("Queue: %lu\n", static_cast<unsigned long>(pendingQueueCount));
    Serial.printf("Water Present: %s\n", latestReading.hasWater ? "YES" : "NO");
    Serial.printf("Tank: %.1f %%\n", latestReading.tankLevelPercent);
    Serial.printf("Temp: %.2f C (ok=%d)\n", latestReading.temperatureC, latestReading.temperatureSensorOk ? 1 : 0);
    Serial.printf("pH: %.2f at %.3f V (ok=%d)\n", latestReading.ph, latestReading.phVoltage, latestReading.phSensorOk ? 1 : 0);
    Serial.printf("Turbidity: %.2f %% at %.3f V (ok=%d)\n", latestReading.turbidityPercent, latestReading.turbidityVoltage, latestReading.turbiditySensorOk ? 1 : 0);
    Serial.printf("Flow: %.2f L/min (%s)\n", latestReading.flowRateLMin, latestReading.flowSensorState);
  }

  // LCD cycling - syncs with dashboard display
  if (now - lastLcdMs >= LCD_CYCLE_INTERVAL_MS || lastLcdMs == 0) {
    lastLcdMs = now;
    
    if (tankScanTriggered) {
      updateLcd(latestReading, lcdCycleIndex);
      lcdCycleIndex++;
      
      if (lcdCycleIndex >= 3) {
        tankScanTriggered = false;
        lcdCycleIndex = 0;
      }
    } else {
      updateLcd(latestReading, 0);
    }
  }
}
