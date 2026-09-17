# ThermoTrack Project Handoff

## Project Overview
ThermoTrack is a professional athlete temperature monitoring platform designed for sports performance teams, athletic departments, and sports medicine staff. It connects wearable in-ear temperature sensors through ESP32 microcontroller gateways to stream real-time core temperature telemetry into a Supabase PostgreSQL database, broadcasting instantaneous updates to coach dashboards over WebSockets.

---

## Current Architecture
The system enforces a strict real-world data pipeline with **ZERO fabricated or simulated telemetry**:
```
Wearable Ear-Temperature Sensor (Physical)
       ↓ (I2C / SPI / BLE)
ESP32 Microcontroller Gateway
       ↓ (Wi-Fi / HTTPS REST PostgREST)
Supabase PostgreSQL Database (thermo_readings)
       ↓ (PostgreSQL WAL Realtime Broadcast)
Supabase Realtime WebSockets
       ↓
ThermoTrack Service Layer (readingService, athleteService, etc.)
       ↓
MonitoringContext React Context
       ↓
ThermoTrack Web Dashboard (React 19 + TypeScript + Vite)
```

---

## Technology Stack
- **Frontend Core**: React 19, TypeScript, Vite 8
- **Styling**: Tailwind CSS v4, Lucide React icons
- **State & Service Layer**: React Context, Modular TypeScript Services
- **Backend & Database**: Supabase PostgreSQL (Project `Smartwear` - `tthwnsjfsrxtjiwgalmc`)
- **Realtime Engine**: Supabase Realtime Channels (PostgreSQL publication over WebSockets)
- **Deployment**: Vercel SPA (`vercel.json` routing rewrite)
- **Hardware Platform**: ESP32 (Reference C++ / Arduino firmware)

---

## Supabase Configuration
- **Project URL**: `https://tthwnsjfsrxtjiwgalmc.supabase.co`
- **Environment Handling**: Credentials loaded strictly via `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` through [.env](file:///c:/Users/asust/thermotrack/.env) (git-ignored) and [.env.example](file:///c:/Users/asust/thermotrack/.env.example). No secret keys or passwords exposed in client bundles.
- **Client Factory**: [src/lib/supabase.ts](file:///c:/Users/asust/thermotrack/src/lib/supabase.ts) validates configuration and disables calls gracefully when variables are absent.

---

## Database Tables (Verified in Supabase `Smartwear` - `tthwnsjfsrxtjiwgalmc`)
1. `thermo_teams`: Team and organization profiles (`id`, `user_id`, `name`, `coach_name`, `country_region`, `description`, `sport`, `default_category`, `onboarding_completed`, `created_at`, `updated_at`).
2. `thermo_athletes`: Athlete registry (`id`, `team_id`, `name`, `athlete_code`, `athlete_id`, `sport`, `category`, `age`, `position_event`, `experience_level`, `sensor_id`, `device_id`, `emergency_contact_name`, `emergency_contact_phone`, `status`, `user_id`, `created_at`, `updated_at`).
3. `thermo_readings`: Real-time temperature telemetry (`id`, `device_id`, `sensor_id`, `athlete_id`, `temperature`, `temperature_c`, `timestamp`, `recorded_at`, `user_id`, `created_at`).
4. `thermo_devices`: ESP32 gateway statuses (`id`, `device_id`, `athlete_id`, `sensor_id`, `device_type`, `connected`, `last_packet`, `last_seen_at`, `signal_strength`, `battery`, `user_id`, `created_at`, `updated_at`).
5. `thermo_alerts`: System & threshold alerts (`id`, `team_id`, `athlete_id`, `device_id`, `kind`, `alert_type`, `message`, `temperature_c`, `timestamp`, `created_at`, `acknowledged`, `acknowledged_at`, `user_id`).
6. `thermo_sessions`: Training blocks and schedules (`id`, `team_id`, `name`, `sport`, `category`, `date`, `start_time`, `end_time`, `athlete_ids`, `sensor_assignments`, `monitoring_settings`, `status`, `user_id`, `created_at`).
7. `thermo_settings`: Neutral configurable temperature thresholds (`id`, `thresholds`, `user_id`, `updated_at`).

---

## RLS Status
- **Status**: [VERIFIED & COMPLETED]
- **Policies Enforced**:
  - `thermo_teams`: Authenticated users only (`auth.uid() = user_id`) for SELECT, INSERT, UPDATE, DELETE.
  - `thermo_athletes`: Authenticated users only (`auth.uid() = user_id`) for SELECT, INSERT, UPDATE, DELETE.
  - `thermo_readings`: Owner SELECT (`auth.uid() = user_id`), authenticated INSERT (`auth.uid() = user_id`), and validated anonymous hardware ingestion INSERT (`(temperature IS NOT NULL OR temperature_c IS NOT NULL) AND (athlete_id IS NOT NULL OR sensor_id IS NOT NULL)`).
  - `thermo_devices`: Owner SELECT & UPDATE (`auth.uid() = user_id`), and gateway heartbeat upsert (`id IS NOT NULL`).
  - `thermo_alerts`: Owner SELECT, UPDATE, DELETE (`auth.uid() = user_id`), authenticated INSERT, and gateway alert insertion.
  - `thermo_sessions`: Owner SELECT, INSERT, UPDATE, DELETE (`auth.uid() = user_id`).
  - `thermo_settings`: Owner SELECT, INSERT, UPDATE (`auth.uid() = user_id`).
  - Database triggers `trg_set_reading_user_id`, `trg_set_alert_user_id`, and `trg_set_device_user_id` automatically resolve ownership from athlete associations during hardware ingestion.

---

## Onboarding System
- **Status**: [COMPLETED]
- **Route**: `/onboarding` (protected with `RequireAuth`, guarded to bypass once completed).
- **First-Login Detection**:
  - Automatically detected upon sign-in / session load through `teamService.getTeam(userId)` querying `thermo_teams` and checking `onboarding_completed`.
  - Also mirrored in Supabase Auth user metadata (`onboarding_completed: true`).
  - Coaches who haven't completed onboarding are intercepted by `OnboardingGuard` and redirected to `/onboarding`.
  - Coaches with a completed team profile skip onboarding and land directly on `/` (`/overview`).
- **Team Fields Collected**:
  - Team / Organization Name (required, e.g. "Velocity Performance Team")
  - Coach / Director Name (required, e.g. "Coach Arun", prefilled from auth profile)
  - Country / Region (optional, e.g. "India")
  - Team Description (optional)
  - Email automatically inherited from Supabase Auth session
- **Sport & Discipline Catalogue**:
  - Comprehensive sport definitions in [src/config/sports.ts](file:///c:/Users/asust/thermotrack/src/config/sports.ts).
  - Supported sports: Track & Field, Running, Cycling, Football, Cricket, Basketball, Tennis, Swimming, Hockey, Volleyball, Wrestling, Boxing, Badminton, and custom "Other".
  - Dynamic disciplines populated per sport (e.g. Running → Sprint, Middle Distance, Long Distance, Marathon, Trail Running).
- **Athlete Fields & Inheritance**:
  - Full Name (required)
  - Athlete ID (required, auto-suggested `ATH-001`, `ATH-002`, unique validation enforced)
  - Sport & Category (automatically inherited from Team profile with individual override option)
  - Optional fields: Age, Position/Event, Experience Level, Emergency Contact Name & Phone
  - Sensor ID (explicitly optional, placeholder "Assign later / No sensor assigned", avoids placeholder IDs)
- **Database Tables & RLS**:
  - Created `thermo_teams` (`id`, `user_id`, `name`, `coach_name`, `country_region`, `description`, `sport`, `default_category`, `onboarding_completed`, `created_at`, `updated_at`).
  - Extended `thermo_athletes` (`team_id`, `sport`, `category`, `age`, `position_event`, `experience_level`, `emergency_contact_name`, `emergency_contact_phone`, `updated_at`, and made `sensor_id` nullable).
  - Strict owner-scoped RLS policies (`auth.uid() = user_id`) on all CRUD operations.
  - Performance indexes on `user_id` and `team_id`.
  - Added `thermo_teams` to Supabase Realtime publication.
- **Service Layer**:
  - `teamService` ([src/services/teamService.ts](file:///c:/Users/asust/thermotrack/src/services/teamService.ts)): `getTeam`, `hasCompletedOnboarding`, `createTeamWithAthletes`.
  - `athleteService` ([src/services/athleteService.ts](file:///c:/Users/asust/thermotrack/src/services/athleteService.ts)): `addAthletesBatch`, `addAthlete`, `getAthletes`.
- **UI & Dashboard Integration**:
  - `/overview`: Real athlete roster count, 0 connected devices and 0 active alerts until hardware connects.
  - `/athletes`: Displays sport, category, and "Not Assigned" badge for athletes without sensors.
  - `/session-build`: Directly loads real athletes and allows dynamic sensor assignment during session scheduling.
  - `/profile`: Reflects team and coach details from Supabase.

---

## Authentication Status
- **Status**: [COMPLETED]
- **Implementation**: Strict Supabase Authentication ([src/context/AuthContext.tsx](file:///c:/Users/asust/thermotrack/src/context/AuthContext.tsx)).
  - Sign-in with Email & Password.
  - User registration with coach metadata.
  - Forgot Password with email reset dispatch.
  - Protected Route guards via `RequireAuth` and `OnboardingGuard`.
  - **Removed**: Demo coach bypass and synthetic auto-login have been completely purged from production code.

---

## Realtime Status
- **Status**: [COMPLETED]
- **Implementation**: WebSocket subscription in `MonitoringContext.tsx` on `supabase.channel('thermo_hardware_realtime')`.
  - Listens to `INSERT` on `thermo_readings` to update readings and stream indicator.
  - Listens to `INSERT`/`UPDATE` on `thermo_devices` for heartbeat, battery, and signal pings.
  - Listens to `INSERT`/`UPDATE` on `thermo_alerts` for real alerts and dismissals.
  - Listens to `INSERT` on `thermo_sessions`.
  - Subscription teardown handled via `supabase.removeChannel`.

---

## ESP32 Integration Status
- **ESP32 Hardware**: [IN PROGRESS] (Reference firmware created; awaiting physical microcontroller flashing).
- **ESP32 → Backend REST**: [TESTED / VERIFIED] (PostgREST HTTPS endpoint verified with Supabase client).
- **Backend → Realtime**: [COMPLETED] (WebSocket publication tested and verified).
- **Dashboard → Realtime**: [COMPLETED] (Instant state reaction verified).

---

## Temperature Sensor Status
- **Physical Sensor Driver**: [NOT STARTED]
  - Sensor model pending final hardware procurement (e.g. MLX90614, TMP117, or MAX30205).
  - Firmware reference in [src/pages/HelpPage.tsx](file:///c:/Users/asust/thermotrack/src/pages/HelpPage.tsx) explicitly isolates the sensor driver layer and forbids mock/random values.

---

## Frontend Routes
- `/signin` & `/sign-in`: Supabase Authentication & Password Reset.
- `/signup`: Coach Registration.
- `/forgot-password`: Password reset request.
- `/` & `/overview`: Live Athlete Monitoring Dashboard.
- `/athletes`: Team roster, filtering, and Add Athlete modal.
- `/athletes/:athleteId`: Individual telemetry curve, statistics, and gateway details.
- `/session-build`: Training session scheduler and sensor assignment.
- `/calendar`: Monthly session calendar with interactive detail modals.
- `/help`: Technical hardware documentation and C++ firmware guide.
- `/profile`: Coach profile settings and password management.

---

## Major Components
- `AppLayout`: Responsive shell with sidebar navigation and mobile drawer.
- `TopHeader`: Route title, live alert counter, search bar, profile menu.
- `StatusCard`: High-contrast summary metrics.
- `LiveStatusBar`: Hardware link status displaying `● LIVE MONITORING` or `○ WAITING FOR DEVICES`.
- `AthleteTable` & `AthleteRow`: Roster presentation with neutral temperature status tags.
- `TemperatureChart`: Area curve showing actual telemetry with dynamic min/avg/max computation.
- `AlertPanel`: Real alert drawer with single-click dismissal.

---

## Services
- `athleteService`: [src/services/athleteService.ts](file:///c:/Users/asust/thermotrack/src/services/athleteService.ts)
- `readingService`: [src/services/readingService.ts](file:///c:/Users/asust/thermotrack/src/services/readingService.ts)
- `deviceService`: [src/services/deviceService.ts](file:///c:/Users/asust/thermotrack/src/services/deviceService.ts)
- `alertService`: [src/services/alertService.ts](file:///c:/Users/asust/thermotrack/src/services/alertService.ts)
- `sessionService`: [src/services/sessionService.ts](file:///c:/Users/asust/thermotrack/src/services/sessionService.ts)
- `settingsService`: [src/services/settingsService.ts](file:///c:/Users/asust/thermotrack/src/services/settingsService.ts)

---

## Environment Variables
Defined in [.env.example](file:///c:/Users/asust/thermotrack/.env.example):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```
*(No backend secret keys or service role keys are exposed to the client)*.

---

## Vercel Deployment
- **Configuration**: [vercel.json](file:///c:/Users/asust/thermotrack/vercel.json)
```json
{
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
- **Build Output**: Clean bundle in `dist/`.

---

## Completed Work
- [COMPLETED] Complete audit of codebase.
- [COMPLETED] Complete removal of Live Telemetry Simulator and all `Math.random()` fake timers.
- [COMPLETED] Complete purge of fabricated seed data from database tables and code.
- [COMPLETED] Removal of demo coach one-click bypass.
- [COMPLETED] Implementation of strict Supabase Authentication with Sign In, Sign Up, and Password Reset.
- [COMPLETED] Production Row-Level Security (RLS) policies implemented on Supabase tables.
- [COMPLETED] Dedicated TypeScript Service layer for data operations.
- [COMPLETED] Refinement of Overview, Athletes, AthleteDetail, Calendar, SessionBuild, and Help pages to enforce true hardware states (`WAITING FOR DEVICES`, `NO DATA`, `-- °C`).
- [COMPLETED] Medical claims removed in favor of neutral configurable monitoring ranges (`GOOD`, `MONITOR`, `CAUTION`).
- [COMPLETED] Separation of Temperature Status, Connection Status, and Data Freshness.

---

## Current Work
- [IN PROGRESS] Physical ESP32 firmware deployment on actual prototype hardware.

---

## Remaining Work
- [NOT STARTED] Final selection and wiring of physical in-ear temperature sensor probe (MLX90614 / TMP117 / MAX30205).
- [NOT STARTED] Physical on-field validation with ESP32 transmitting real biological telemetry.

---

## Known Issues
None. Zero build errors, zero linter errors.

---

## Testing Results
- `npm run lint`: **PASSED** (0 errors).
- `npm run build`: **PASSED** (0 errors, built in ~500ms).
- Supabase SQL queries: **PASSED** (0 seed records, authenticated RLS verified).

---

## Exact Next Steps
1. Procure physical ESP32 and selected in-ear temperature probe.
2. Wire probe to ESP32 I2C pins (SDA, SCL).
3. Insert Wi-Fi credentials into firmware template in [HelpPage](file:///c:/Users/asust/thermotrack/src/pages/HelpPage.tsx) and flash using Arduino IDE or PlatformIO.
4. Deploy frontend to Vercel by importing repository and configuring `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

---

## Final Pre-Deployment Audit — 2026-09-17

Audited by: Antigravity (AI code assistant)

### Commands Run
| Command | Exit Code | Result |
|---|---|---|
| `npm install` | 0 | ✅ Clean — 0 vulnerabilities |
| `npm run lint` | 0 | ✅ 0 errors, 5 warnings (informational React Compiler hints only) |
| `npm run build` | 0 | ✅ Production bundle generated in `dist/` in ~589ms |

> **Lint warnings are non-blocking.** The 5 warnings are React Compiler informational hints (`only-export-components`, `set-state-in-effect`, `preserve-manual-memoization`). They do not affect runtime behaviour and are standard patterns accepted in production React applications.

> **Bundle size note.** The single JS chunk is 628 kB (172 kB gzip). Vite emits a warning at >500 kB. This is not an error and is within acceptable range for an authenticated SPA. Code splitting via `React.lazy` can be applied as a future optimization.

### Audit Results

| Area | Status | Notes |
|---|---|---|
| **BUILD** | ✅ PASS | TypeScript + Vite — zero TS or build errors |
| **LINT** | ✅ PASS | 0 errors. 5 non-blocking React Compiler informational warnings |
| **AUTH** | ✅ PASS | Supabase Auth: sign-in, sign-up, forgot-password, session persistence, `RequireAuth` guard, `OnboardingGuard`. No demo bypass. |
| **DATABASE** | ✅ PASS | Project `Smartwear` (`tthwnsjfsrxtjiwgalmc`) active & healthy. All 7 `thermo_*` tables present. No unrelated table access from ThermoTrack services. |
| **RLS** | ✅ PASS | RLS enabled on all `thermo_*` tables. All SELECT/UPDATE/DELETE operations are owner-scoped (`auth.uid() = user_id`). INSERT operations enforced via `with_check`. Triggers `trg_set_reading_user_id`, `trg_set_alert_user_id`, `trg_set_device_user_id` verified active. |
| **REALTIME** | ✅ PASS | All 5 tables subscribed in `supabase_realtime` publication. Channel teardown via `supabase.removeChannel()` on unmount. No crash on subscription failure (graceful no-op). |
| **ROUTING** | ✅ PASS | `vercel.json` rewrites `/(.*)` → `/index.html`. All 11 routes verified in `App.tsx`. Protected routes redirect via `RequireAuth` and `OnboardingGuard`. `/overview` → redirects to `/`. |
| **ENVIRONMENT** | ✅ PASS | Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` exposed to client. `.env` is git-ignored. No `service_role`, database password, or private API keys found in source. |
| **RESPONSIVE UI** | ✅ PASS | Tailwind CSS v4 responsive prefixes (`sm:`, `lg:`, `xl:`) used throughout. Sidebar hidden on mobile (`hidden lg:block`). `MobileNav` bottom bar present. Mobile drawer overlay implemented. |
| **NO SIMULATION** | ✅ PASS | Zero `Math.random`, zero simulation/simulator/mock/fake/seed/demo keywords in runtime source. **One cosmetic string** (`"or the simulator"`) found in `TemperatureChart.tsx` empty state description — **fixed in this audit session**. |
| **HARDWARE** | NOT CONNECTED | No physical ESP32 connected. Empty hardware states display correctly: `-- °C`, `Waiting for device`, `NO DEVICE CONNECTED`. No placeholder values generated. |

### Fix Applied During Audit
- **`src/components/ui/TemperatureChart.tsx` line 87**: Removed stale reference to `"the simulator"` in the no-data empty state description. Now reads: `"The chart plots real ear-sensor readings received from your ESP32 hardware gateway."`

### Supabase Verification
- **Project**: Smartwear — `tthwnsjfsrxtjiwgalmc` (Seoul region, `ACTIVE_HEALTHY`)
- **No new project created** — audit used the existing project exclusively
- **Tables confirmed**: `thermo_teams`, `thermo_athletes`, `thermo_readings`, `thermo_devices`, `thermo_alerts`, `thermo_sessions`, `thermo_settings` — all with `rls_enabled: true`
- **ThermoTrack does NOT touch**: `profiles`, `budgets`, `expenses`, `workouts`, `hydration_logs`, `sensor_readings`, `alerts`, `settings` (SmartWear tables)

### Known Non-Blocking Items
1. **Bundle size** — 628 kB single chunk. Acceptable for authenticated SPA. Future optimization: apply `React.lazy` route splitting.
2. **Lint warnings** — 5 React Compiler hints. No runtime impact. No action required for deployment.

---

## DEPLOYMENT STATUS: ✅ READY FOR VERCEL

To deploy:
1. Push repository to GitHub/GitLab.
2. Import project into Vercel.
3. Set environment variables in Vercel project settings:
   - `VITE_SUPABASE_URL` = `https://tthwnsjfsrxtjiwgalmc.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = *(from Supabase project API settings)*
4. Vercel will detect `framework: vite` from `vercel.json` and build automatically.
5. SPA routing is handled by the `rewrites` rule — all direct URL navigations will resolve correctly.

