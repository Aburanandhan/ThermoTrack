import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Cpu,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatusCard } from '../components/ui/StatusCard'
import { TopHeader } from '../components/layout/TopHeader'
import { useAppShell } from '../components/layout/useAppShell'
import { useMonitoring } from '../context/MonitoringContext'
import { formatTemperature, formatTimestamp } from '../lib/format'
import {
  connectionFromDevice,
  connectionLabel,
  deviceForAthlete,
  latestReadingForAthlete,
  resolveTemperatureStatus,
} from '../lib/status'
import { TemperatureStatus } from '../components/ui/TemperatureStatus'

export function OverviewPage() {
  const { openNav } = useAppShell()
  const {
    athletes,
    readings,
    devices,
    alerts,
    sessions,
    stream,
    thresholds,
    loading,
    error,
    refresh,
    dismissAlert,
  } = useMonitoring()

  const connectedDevicesCount = devices.filter((d) => d.connected).length

  return (
    <>
      <TopHeader
        title="Athlete Monitoring Overview"
        subtitle="Monitor athlete temperature, sensor connectivity and live performance signals from one place."
        onMenu={openNav}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              title="Refresh telemetry"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <Link
              to="/session-build"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal px-3 text-xs font-medium text-white hover:bg-teal-dark"
            >
              <Plus className="h-3.5 w-3.5" />
              New Session
            </Link>
          </div>
        }
      />

      <main className="space-y-6 p-4 sm:p-6">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            <p className="font-semibold">UNABLE TO LOAD MONITORING DATA</p>
            <p className="mt-0.5">{error}</p>
          </div>
        ) : null}

        {/* Live Stream Indicator Banner */}
        <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                stream.connected ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {stream.connected ? (
                <Wifi className="h-4 w-4" />
              ) : (
                <WifiOff className="h-4 w-4" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    stream.connected
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      stream.connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  {stream.connected ? 'LIVE MONITORING' : 'WAITING FOR DEVICES'}
                </span>
                <span className="text-xs text-slate-400">
                  {stream.lastUpdate
                    ? `Last packet received ${formatTimestamp(stream.lastUpdate)}`
                    : 'No telemetry packets received yet'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/help"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              <Cpu className="h-3.5 w-3.5 text-teal" />
              ESP32 Setup Guide
            </Link>
          </div>
        </section>

        {loading ? (
          <p className="text-xs text-slate-500">Loading live monitoring data…</p>
        ) : null}

        {/* Summary Metric Cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatusCard
            label="Athletes Monitored"
            value={athletes.length ? String(athletes.length) : '0'}
            hint={athletes.length ? `${athletes.length} registered in roster` : 'No athletes added yet'}
          />
          <StatusCard
            label="Devices Connected"
            value={devices.length ? String(connectedDevicesCount) : '0'}
            hint={
              devices.length
                ? `${connectedDevicesCount} of ${devices.length} reporting`
                : 'Waiting for device'
            }
          />
          <StatusCard
            label="Active Alerts"
            value={alerts.length ? String(alerts.length) : '0'}
            hint={alerts.length ? 'Attention recommended' : 'NO ACTIVE ALERTS'}
          />
          <StatusCard
            label="Live Data Stream"
            value={stream.connected ? 'Live' : 'Standby'}
            hint={stream.connected ? 'Receiving real-time packets' : 'Waiting for device'}
          />
        </div>

        {/* Live Athlete Monitoring Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base font-semibold text-navy">Live Athlete Monitoring</h2>
              <p className="text-xs text-slate-500">Real-time temperature visibility across your team.</p>
            </div>
            {athletes.length > 0 ? (
              <Link to="/athletes" className="text-xs font-semibold text-teal hover:underline">
                View All Athletes ({athletes.length}) →
              </Link>
            ) : null}
          </div>

          {athletes.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs">
              <Users className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-3 text-sm font-semibold text-navy">No athletes added yet</h3>
              <p className="mt-1 text-xs text-slate-500">
                Register athletes to pair with wearable in-ear sensors and begin monitoring.
              </p>
              <Link
                to="/athletes"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-xs font-semibold text-white hover:bg-teal-dark"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add First Athlete
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {athletes.map((athlete) => {
                const reading = latestReadingForAthlete(readings, athlete.id)
                const device = deviceForAthlete(devices, athlete)
                const connection = connectionFromDevice(device)
                const tempStatus = resolveTemperatureStatus(reading?.temperature, thresholds)

                // Calculate simple trend if 2+ readings exist
                const athleteReadings = readings.filter((r) => r.athleteId === athlete.id)
                const prevReading =
                  athleteReadings.length >= 2
                    ? athleteReadings[athleteReadings.length - 2]
                    : null
                const trend =
                  reading?.temperature && prevReading?.temperature
                    ? reading.temperature - prevReading.temperature
                    : null

                return (
                  <Link
                    key={athlete.id}
                    to={`/athletes/${athlete.id}`}
                    className="block rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-teal/40 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-navy">{athlete.name}</h4>
                        <p className="text-xs text-slate-400">
                          {athlete.athleteId} · Sensor: {athlete.sensorId || 'Unassigned'}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          connection === 'connected'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            connection === 'connected' ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        {connectionLabel(connection)}
                      </span>
                    </div>

                    {/* Dominant Temperature Reading */}
                    <div className="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Estimated Core Temperature
                        </p>
                        <div className="mt-0.5 flex items-baseline gap-2">
                          <span className="text-3xl font-semibold tabular-nums tracking-tight text-navy">
                            {formatTemperature(reading?.temperature)}
                          </span>
                          {trend !== null && Math.abs(trend) >= 0.1 ? (
                            <span
                              className={`inline-flex items-center text-xs font-semibold ${
                                trend > 0 ? 'text-amber-600' : 'text-teal'
                              }`}
                            >
                              {trend > 0 ? (
                                <TrendingUp className="h-3 w-3 mr-0.5" />
                              ) : (
                                <TrendingDown className="h-3 w-3 mr-0.5" />
                              )}
                              {Math.abs(trend).toFixed(1)}°
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div>
                        <TemperatureStatus status={tempStatus} />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Gateway: {device?.deviceId || 'Waiting for device'}</span>
                      <span>
                        {reading?.timestamp
                          ? formatTimestamp(reading.timestamp)
                          : 'Waiting for first reading'}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* Split Section: Hardware Status & Alerts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Hardware Gateways */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-navy" />
                <h3 className="text-sm font-semibold text-navy">Hardware & Gateways</h3>
              </div>
              <span className="text-xs text-slate-400">{devices.length} Registered</span>
            </div>

            {devices.length === 0 ? (
              <div className="mt-6 py-4 text-center">
                <p className="text-xs font-medium text-slate-600">NO DEVICE CONNECTED</p>
                <p className="mt-1 text-xs text-slate-400">
                  Connect an ESP32 sensor gateway to begin receiving temperature measurements.
                </p>
              </div>
            ) : (
              <div className="mt-3 divide-y divide-slate-100">
                {devices.map((device) => (
                  <div key={device.deviceId} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          device.connected ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                      />
                      <div>
                        <p className="text-xs font-semibold text-navy">{device.deviceId}</p>
                        <p className="text-[11px] text-slate-400">
                          Sensor: {device.sensorId || 'Assigned dynamically'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-600">
                      <span>
                        {device.signalStrength !== null ? `${device.signalStrength} dBm` : '--'}
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                        {device.battery !== null ? `${device.battery}%` : 'Not available'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Active Alerts */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-navy">Monitoring Alerts</h3>
              </div>
              <span className="text-xs text-slate-400">{alerts.length} Active</span>
            </div>

            {alerts.length === 0 ? (
              <div className="mt-6 flex flex-col items-center justify-center py-4 text-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                <p className="mt-2 text-xs font-medium text-navy">NO ACTIVE ALERTS</p>
                <p className="text-[11px] text-slate-400">
                  No threshold breaches or hardware disconnects detected.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-2.5">
                {alerts.slice(0, 4).map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start justify-between rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-amber-950">{alert.message}</p>
                      <p className="mt-0.5 text-[11px] text-amber-800">
                        {formatTimestamp(alert.timestamp)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void dismissAlert(alert.id)}
                      className="rounded bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Dismiss
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sessions Section */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-navy" />
              <h3 className="text-sm font-semibold text-navy">Training Sessions</h3>
            </div>
            <Link to="/calendar" className="text-xs font-semibold text-teal hover:underline">
              View Calendar →
            </Link>
          </div>

          {sessions.length === 0 ? (
            <div className="mt-4 py-4 text-center">
              <p className="text-xs font-medium text-slate-600">No sessions scheduled</p>
              <p className="mt-0.5 text-xs text-slate-400">
                Use the Session Builder to organize athlete monitoring windows.
              </p>
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sessions.slice(0, 3).map((session) => (
                <div
                  key={session.id}
                  className="rounded-lg border border-slate-200 p-3.5 hover:border-teal/50"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        session.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {session.status}
                    </span>
                    <span className="text-xs text-slate-400">
                      {session.date || '--'} · {session.startTime || '--:--'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-navy">{session.name}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <Users className="h-3.5 w-3.5" />
                    <span>{session.athleteIds?.length || 0} athletes assigned</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  )
}
