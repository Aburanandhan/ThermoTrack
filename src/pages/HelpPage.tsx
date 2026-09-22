import { Check, ChevronDown, ChevronUp, Copy, Cpu, FileCode2, Globe, Shield } from 'lucide-react'
import { useState } from 'react'
import { TopHeader } from '../components/layout/TopHeader'
import { useAppShell } from '../components/layout/useAppShell'
import { AccordionItem } from '../components/ui/Accordion'

const ESP32_REFERENCE_FIRMWARE = `/*
 * ThermoTrack ESP8266 / ESP32 Hardware Integration Firmware (Reference Template)
 *
 * NOTE: This reference firmware separates:
 * 1. Communication Layer (Wi-Fi + Supabase REST PostgREST)
 * 2. Sensor Driver Layer (Attach your sensor driver: e.g. DHT11, I2C, SPI, or OneWire)
 * 3. Heartbeat & Telemetry Transmission (Upsert to thermo_devices and insert to thermo_readings)
 *
 * NOTE: The ESP does NOT generate timestamps. Supabase PostgreSQL NOW() is the source of truth.
 * Current DHT11 data is labeled "Sensor Temperature".
 */

#if defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <ESP8266HTTPClient.h>
  #include <WiFiClientSecure.h>
#elif defined(ESP32)
  #include <WiFi.h>
  #include <HTTPClient.h>
  #include <WiFiClientSecure.h>
#endif
#include <ArduinoJson.h>

// ----------------------------------------------------
// 1. Wi-Fi & Supabase Configuration
// ----------------------------------------------------
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Supabase REST endpoints & Anon API Key
const char* SUPABASE_HEARTBEAT_BASE_URL = "https://YOUR_PROJECT_REF.supabase.co/rest/v1/thermo_devices";
const char* SUPABASE_READINGS_URL  = "https://YOUR_PROJECT_REF.supabase.co/rest/v1/thermo_readings";
const char* SUPABASE_ANON_KEY      = "YOUR_SUPABASE_ANON_KEY";

// Device & Sensor Identification
const char* DEVICE_ID  = "THERMO-001";     // Gateway / Microcontroller ID
const char* SENSOR_ID  = "TEMP-001";       // Temperature Sensor ID
const char* ATHLETE_ID = "TEMP-001";       // Associated Athlete Code (or athlete ID)

unsigned long lastHeartbeatTime = 0;
const unsigned long HEARTBEAT_INTERVAL_MS = 5000; // Heartbeat every ~5 seconds

// ----------------------------------------------------
// 2. Sensor Driver Layer (Hardware Specific)
// ----------------------------------------------------
bool readPhysicalTemperatureSensor(float* outTemperatureC) {
  // Replace with actual sensor reading calls (e.g. DHT11, MLX90614, TMP117):
  // float temp = dht.readTemperature();
  // if (isnan(temp)) return false;
  // *outTemperatureC = temp;
  // return true;
  return false;
}

// ----------------------------------------------------
// 3. Heartbeat Transmission (PATCH to thermo_devices)
//
// Uses HTTP PATCH ?id=eq.DEVICE_ID to UPDATE the existing row.
// PATCH cannot cause a 409 duplicate-key error.
//
// If the device row does not exist yet, run a one-time INSERT first
// (see setup() below), then every subsequent heartbeat uses PATCH.
// ----------------------------------------------------
String buildHeartbeatUrl() {
  // PATCH to the row matching id = DEVICE_ID
  return String(SUPABASE_HEARTBEAT_BASE_URL) + "?id=eq." + DEVICE_ID;
}

bool sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return false;

  WiFiClientSecure client;
  client.setInsecure(); // Accept self-signed / no CA validation on microcontrollers

  HTTPClient http;
  http.begin(client, buildHeartbeatUrl());
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Prefer", "return=minimal");

  // Only update the fields that change each heartbeat.
  // last_seen_at and last_packet are set by the database trigger (NOW()).
  // Do NOT send a timestamp from the ESP clock.
  StaticJsonDocument<128> doc;
  doc["connected"]       = true;
  doc["signal_strength"] = WiFi.RSSI();

  String payload;
  serializeJson(doc, payload);

  Serial.println("[Heartbeat] Sending: " + payload);
  int httpCode = http.PATCH(payload);
  Serial.printf("[Heartbeat] HTTP %d\\n", httpCode);
  http.end();

  return (httpCode >= 200 && httpCode < 300);
}

// One-time registration: INSERT the device row when it does not exist yet.
// Called once at startup before the heartbeat loop begins.
// Subsequent heartbeats use PATCH (see sendHeartbeat above).
bool registerDevice() {
  if (WiFi.status() != WL_CONNECTED) return false;

  WiFiClientSecure client;
  client.setInsecure();

  // UPSERT endpoint: POST with ?on_conflict=id + Prefer: resolution=merge-duplicates
  String upsertUrl = String(SUPABASE_HEARTBEAT_BASE_URL) + "?on_conflict=id";

  HTTPClient http;
  http.begin(client, upsertUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Prefer", "resolution=merge-duplicates,return=minimal");

  StaticJsonDocument<256> doc;
  doc["id"]              = DEVICE_ID;
  doc["device_id"]       = DEVICE_ID;
  doc["sensor_id"]       = SENSOR_ID;
  doc["connected"]       = true;
  doc["signal_strength"] = WiFi.RSSI();

  String payload;
  serializeJson(doc, payload);

  Serial.println("[Register] Upserting device row: " + payload);
  int httpCode = http.POST(payload);
  Serial.printf("[Register] HTTP %d\\n", httpCode);
  http.end();

  return (httpCode >= 200 && httpCode < 300);
}

// ----------------------------------------------------
// 4. Telemetry Transmission (INSERT to thermo_readings)
// ----------------------------------------------------
bool transmitTelemetry(float temperatureC) {
  if (WiFi.status() != WL_CONNECTED) return false;

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.begin(client, SUPABASE_READINGS_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Prefer", "return=minimal");

  StaticJsonDocument<256> doc;
  doc["athlete_id"]  = ATHLETE_ID;
  doc["sensor_id"]   = SENSOR_ID;
  doc["device_id"]   = DEVICE_ID;
  doc["temperature"] = temperatureC;

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);
  http.end();

  return (httpCode >= 200 && httpCode < 300);
}

void setup() {
  Serial.begin(115200);
  Serial.println("[ThermoTrack] Initializing Gateway...");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\n[ThermoTrack] Wi-Fi Connected. IP: " + WiFi.localIP().toString());

  // Register (upsert) device row on startup — this handles
  // both first-boot (INSERT) and reconnect (UPDATE) safely.
  registerDevice();
  lastHeartbeatTime = millis(); // Start heartbeat timer after registration.
}

void loop() {
  unsigned long currentMillis = millis();

  // 1. Periodic Heartbeat (~5 seconds)
  if (currentMillis - lastHeartbeatTime >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatTime = currentMillis;
    if (sendHeartbeat()) {
      Serial.println("[Heartbeat] Heartbeat acknowledged by Supabase.");
    } else {
      Serial.println("[Heartbeat] Failed to send heartbeat ping.");
    }
  }

  // 2. Physical Sensor Telemetry Measurement
  float temperature = 0.0;
  if (readPhysicalTemperatureSensor(&temperature)) {
    Serial.printf("[Sensor] Valid sensor temperature: %.2f C\\n", temperature);
    if (transmitTelemetry(temperature)) {
      Serial.println("[Telemetry] Ingested into Supabase successfully.");
    }
  }

  delay(1000);
}`

export function HelpPage() {
  const { openNav } = useAppShell()
  const [copied, setCopied] = useState(false)
  const [isFirmwareExpanded, setIsFirmwareExpanded] = useState(true)

  const copyCode = () => {
    navigator.clipboard.writeText(ESP32_REFERENCE_FIRMWARE).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <>
      <TopHeader
        title="Hardware & System Documentation"
        subtitle="ESP32 gateway setup, in-ear sensor integration, and telemetry guidelines"
        onMenu={openNav}
      />
      <main className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
        {/* Architecture Badges */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-2 text-teal">
              <Cpu className="h-5 w-5" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-navy">
                Gateway Hardware
              </h3>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              ESP32 microcontrollers communicate with wearable sensors and transmit telemetry via
              HTTPS to the database.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-2 text-teal">
              <Globe className="h-5 w-5" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-navy">
                Data Pipeline
              </h3>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Raw sensor measurements are validated by the ESP32 before reaching Supabase
              PostgreSQL and broadcasting over Realtime.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-2 text-teal">
              <Shield className="h-5 w-5" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-navy">
                Data Integrity
              </h3>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Zero simulated telemetry. The dashboard displays strictly real readings, indicating
              clear offline/waiting states when hardware is quiet.
            </p>
          </div>
        </div>

        {/* ESP32 Firmware Reference Section */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div
            className={`flex items-center justify-between ${
              isFirmwareExpanded ? 'border-b border-slate-100 pb-3' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <FileCode2 className="h-5 w-5 text-teal" />
              <div>
                <h3 className="text-sm font-semibold text-navy">
                  ESP32 Reference Firmware (C++ / Arduino)
                </h3>
                <p className="text-xs text-slate-500">
                  Separated into Communication, Sensor Driver, and Telemetry layers
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFirmwareExpanded((prev) => !prev)}
                aria-expanded={isFirmwareExpanded}
                aria-label={isFirmwareExpanded ? 'Minimize firmware section' : 'Expand firmware section'}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
              >
                {isFirmwareExpanded ? (
                  <ChevronUp className="h-4 w-4 text-slate-600" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-600" />
                )}
              </button>
              <button
                type="button"
                onClick={copyCode}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy Code
                  </>
                )}
              </button>
            </div>
          </div>

          {isFirmwareExpanded && (
            <>
              <div className="mt-4 overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs font-mono text-slate-200">
                <pre>{ESP32_REFERENCE_FIRMWARE}</pre>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                * Reference firmware only: Attach the appropriate manufacturer driver for your physical
                ear temperature probe. Never flash code generating synthetic or randomized numbers.
              </p>
            </>
          )}
        </section>

        {/* Structured Documentation Accordion */}
        <div className="rounded-xl border border-slate-200 bg-white px-5 shadow-xs divide-y divide-slate-100">
          <AccordionItem title="Getting Started" defaultOpen>
            <p className="text-xs leading-relaxed text-slate-600">
              ThermoTrack is an athlete monitoring system designed for athletic departments, performance
              staff, and sports medicine teams. It aggregates real telemetry captured by wearable in-ear
              temperature sensors through ESP32 hubs.
            </p>
          </AccordionItem>

          <AccordionItem title="How ThermoTrack Works">
            <p className="text-xs leading-relaxed text-slate-600">
              The architecture follows a strict real-world telemetry path:
              <br />
              <strong>Wearable Sensor</strong> → <strong>ESP32 Gateway</strong> →{' '}
              <strong>Wi-Fi / HTTPS API</strong> → <strong>Supabase Database</strong> →{' '}
              <strong>Supabase Realtime WebSockets</strong> → <strong>ThermoTrack Dashboard</strong>.
            </p>
          </AccordionItem>

          <AccordionItem title="Connecting ESP32">
            <p className="text-xs leading-relaxed text-slate-600">
              ESP32 units connect to the local Wi-Fi access point near the training field or gym. Each
              device possesses an ID (e.g.{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-teal-dark">
                ESP32_HUB_A
              </code>
              ) and pushes heartbeats to the{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-teal-dark">
                thermo_devices
              </code>{' '}
              table. If no heartbeat arrives, the device displays as Disconnected.
            </p>
          </AccordionItem>

          <AccordionItem title="Connecting the Temperature Sensor">
            <p className="text-xs leading-relaxed text-slate-600">
              The wearable ear-sensor probe interfaces with the ESP32 over digital buses (such as I2C or
              SPI). Ensure the physical sensor driver validates thermal equilibrium before broadcasting
              the reading to prevent false spikes.
            </p>
          </AccordionItem>

          <AccordionItem title="Sending Telemetry">
            <p className="text-xs leading-relaxed text-slate-600">
              Telemetry packets are sent as HTTPS POST requests containing{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-teal-dark">
                athlete_id
              </code>
              ,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-teal-dark">
                sensor_id
              </code>
              , and numeric{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-teal-dark">
                temperature
              </code>
              . The database automatically timestamps each valid measurement.
            </p>
          </AccordionItem>

          <AccordionItem title="Understanding Temperature Readings">
            <p className="text-xs leading-relaxed text-slate-600">
              Readings represent sensor temperatures captured from the tympanic ear-probe.
              Values are classified into neutral monitoring ranges: <strong>GOOD</strong>,{' '}
              <strong>MONITOR</strong>, or <strong>CAUTION</strong>. These states are configurable
              monitoring thresholds and must not be used as clinical or diagnostic determinations.
            </p>
          </AccordionItem>

          <AccordionItem title="Understanding Device Status">
            <p className="text-xs leading-relaxed text-slate-600">
              Connection state (Connected / Disconnected) is strictly isolated from temperature state. A
              connected device with no sensor data displays{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-teal-dark">
                Waiting for first reading
              </code>
              , ensuring staff always know the exact operational status of hardware.
            </p>
          </AccordionItem>

          <AccordionItem title="Alerts">
            <p className="text-xs leading-relaxed text-slate-600">
              Alerts trigger solely when real measurements cross configured coach thresholds or when
              hardware disconnects mid-session. Fake or synthetic alerts are never injected.
            </p>
          </AccordionItem>

          <AccordionItem title="Troubleshooting">
            <ul className="list-disc pl-5 text-xs leading-relaxed text-slate-600 space-y-1">
              <li>
                <strong>Waiting for device:</strong> Ensure the ESP32 has joined Wi-Fi and the correct
                URL is configured.
              </li>
              <li>
                <strong>No Data (-- °C):</strong> The ESP32 is online but the physical sensor has not
                yet provided a valid reading.
              </li>
              <li>
                <strong>Sensor Disconnected:</strong> Verify wire harness and power rails on the probe.
              </li>
            </ul>
          </AccordionItem>

          <AccordionItem title="Data & Privacy">
            <p className="text-xs leading-relaxed text-slate-600">
              Athlete telemetry is secured with Supabase PostgreSQL Row Level Security (RLS). Only
              authenticated staff members can query athlete rosters and historical charts.
            </p>
          </AccordionItem>
        </div>
      </main>
    </>
  )
}
