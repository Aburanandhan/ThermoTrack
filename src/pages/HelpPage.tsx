import { Check, Copy, Cpu, FileCode2, Globe, Shield } from 'lucide-react'
import { useState } from 'react'
import { TopHeader } from '../components/layout/TopHeader'
import { useAppShell } from '../components/layout/useAppShell'
import { AccordionItem } from '../components/ui/Accordion'

const ESP32_REFERENCE_FIRMWARE = `/*
 * ThermoTrack ESP32 Hardware Integration Firmware (Reference Template)
 *
 * NOTE: This reference firmware separates:
 * 1. ESP32 Communication Layer (Wi-Fi)
 * 2. Physical Sensor Driver Layer (Attach your sensor driver: e.g. I2C, SPI, or OneWire)
 * 3. Telemetry Transmission Layer (Supabase PostgREST HTTPS Ingestion)
 *
 * DO NOT use synthetic or random values in production.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ----------------------------------------------------
// 1. ESP32 Communication Layer Configuration
// ----------------------------------------------------
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Supabase REST endpoint URL and API Key
// Table: thermo_readings
const char* SUPABASE_REST_URL = "https://YOUR_PROJECT_REF.supabase.co/rest/v1/thermo_readings";
const char* SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

// Device & Sensor Identification
const char* ATHLETE_ID = "ath_01";          // Associated athlete code in thermo_athletes
const char* SENSOR_ID  = "EAR-SN-401";      // Physical wearable in-ear sensor probe serial

// ----------------------------------------------------
// 2. Sensor Driver Layer (Hardware Specific)
// ----------------------------------------------------
// Include the library for your verified sensor model:
// Example sensors:
// - MLX90614 (Infrared tympanic)
// - TMP117   (High precision medical grade digital sensor)
// - MAX30205 (Clinical body temperature)
//
// Replace this function with actual sensor reading calls:
bool readPhysicalTemperatureSensor(float* outTemperatureC) {
  // [SENSOR DRIVER INTEGRATION]:
  // 1. Query physical sensor over I2C/SPI
  // 2. Read raw registers and convert to Celsius
  // 3. Perform sanity and range checks (e.g. 32.0C <= temp <= 43.0C)
  //
  // Example stub:
  // float temp = sensor.readObjectTempC();
  // if (isnan(temp) || temp < 30.0 || temp > 45.0) return false;
  // *outTemperatureC = temp;
  // return true;

  // Returning false until real hardware driver is initialized:
  return false;
}

// ----------------------------------------------------
// 3. Telemetry Transmission Layer
// ----------------------------------------------------
bool transmitTelemetry(float temperatureC) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  http.begin(SUPABASE_REST_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Prefer", "return=minimal");

  // Construct JSON payload matching thermo_readings schema
  StaticJsonDocument<256> doc;
  doc["athlete_id"]  = ATHLETE_ID;
  doc["sensor_id"]   = SENSOR_ID;
  doc["temperature"] = temperatureC;

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);
  http.end();

  return (httpCode >= 200 && httpCode < 300);
}

void setup() {
  Serial.begin(115200);
  Serial.println("[ThermoTrack] Initializing ESP32 Gateway...");

  // Initialize hardware sensor bus here (e.g. Wire.begin(SDA_PIN, SCL_PIN))

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\n[ThermoTrack] Wi-Fi Connected. IP: " + WiFi.localIP().toString());
}

void loop() {
  float temperature = 0.0;

  // Read validated physical sensor
  if (readPhysicalTemperatureSensor(&temperature)) {
    Serial.printf("[Sensor] Valid core reading: %.2f C\\n", temperature);
    bool sent = transmitTelemetry(temperature);
    if (sent) {
      Serial.println("[Telemetry] Ingested into Supabase successfully.");
    } else {
      Serial.println("[Telemetry] Transmission failed. Retrying next cycle.");
    }
  } else {
    Serial.println("[Sensor] Sensor unattached or awaiting valid thermal reading.");
  }

  delay(4000); // Sample every 4 seconds
}`

export function HelpPage() {
  const { openNav } = useAppShell()
  const [copied, setCopied] = useState(false)

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
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
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

          <div className="mt-4 overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs font-mono text-slate-200">
            <pre>{ESP32_REFERENCE_FIRMWARE}</pre>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            * Reference firmware only: Attach the appropriate manufacturer driver for your physical
            ear temperature probe. Never flash code generating synthetic or randomized numbers.
          </p>
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
              Readings represent estimated core body temperatures captured from the tympanic ear-probe.
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
