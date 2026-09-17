import { ArrowLeft, Cpu, Radio } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { TopHeader } from '../components/layout/TopHeader'
import { useAppShell } from '../components/layout/useAppShell'
import { ConnectionStatus } from '../components/ui/ConnectionStatus'
import { EmptyState } from '../components/ui/EmptyState'
import { TemperatureChart } from '../components/ui/TemperatureChart'
import { TemperatureStatus } from '../components/ui/TemperatureStatus'
import { useMonitoring } from '../context/MonitoringContext'
import { formatDuration, formatTemperature, formatTimestamp } from '../lib/format'
import {
  connectionFromDevice,
  connectionLabel,
  deviceForAthlete,
  latestReadingForAthlete,
  resolveTemperatureStatus,
} from '../lib/status'
import type { HistoryRange } from '../types/monitoring'

export function AthleteDetailPage() {
  const { openNav } = useAppShell()
  const { athleteId } = useParams()
  const { athletes, readings, devices, thresholds, sessions } = useMonitoring()
  const [range, setRange] = useState<HistoryRange>('15m')

  const athlete = athletes.find((item) => item.id === athleteId)
  const reading = athlete ? latestReadingForAthlete(readings, athlete.id) : undefined
  const device = athlete ? deviceForAthlete(devices, athlete) : undefined
  const connection = connectionFromDevice(device)
  const tempStatus = resolveTemperatureStatus(reading?.temperature, thresholds)

  const history = useMemo(
    () => (athlete ? readings.filter((item) => item.athleteId === athlete.id) : []),
    [athlete, readings],
  )

  const session = sessions.find(
    (item) => item.status === 'active' && athlete && item.athleteIds.includes(athlete.id),
  )

  const stats = useMemo(() => {
    if (history.length === 0) return null
    const validTemps = history
      .map((h) => h.temperature)
      .filter((t): t is number => t !== null)

    if (validTemps.length === 0) return null

    const min = Math.min(...validTemps)
    const max = Math.max(...validTemps)
    const avg = validTemps.reduce((a, b) => a + b, 0) / validTemps.length

    return {
      min: `${min.toFixed(1)} °C`,
      avg: `${avg.toFixed(1)} °C`,
      max: `${max.toFixed(1)} °C`,
    }
  }, [history])

  if (!athlete) {
    return (
      <>
        <TopHeader title="Athlete Profile" subtitle="Monitoring Detail" onMenu={openNav} />
        <main className="p-6">
          <Link to="/athletes" className="text-xs font-semibold text-teal hover:underline">
            ← Back to Athletes
          </Link>
          <EmptyState
            className="mt-6"
            title="Athlete not found"
            description="This athlete profile does not exist or has been removed from the roster."
          />
        </main>
      </>
    )
  }

  return (
    <>
      <TopHeader
        title={athlete.name}
        subtitle={`${athlete.athleteId} · Sensor: ${athlete.sensorId || 'Unassigned'}`}
        onMenu={openNav}
      />
      <main className="space-y-5 p-4 sm:p-6">
        <Link
          to="/athletes"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Athletes
        </Link>

        {/* Top Metric Cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Current Temperature"
            value={formatTemperature(reading?.temperature)}
            subtitle="Estimated core body temperature"
          />
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Monitoring State
            </p>
            <div className="mt-2.5">
              <TemperatureStatus status={tempStatus} />
            </div>
            <p className="mt-2 text-[10px] text-slate-400">
              Based on configured monitoring ranges, not a medical diagnosis.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Hardware Link
            </p>
            <div className="mt-2.5">
              <ConnectionStatus state={connection} />
            </div>
            <p className="mt-2 text-[10px] text-slate-400">
              {device?.deviceId ? `Gateway: ${device.deviceId}` : 'Waiting for device pairing'}
            </p>
          </div>
          <Metric
            label="Data Freshness"
            value={
              reading?.timestamp
                ? formatTimestamp(reading.timestamp)
                : connection === 'connected'
                  ? 'Waiting for first reading'
                  : 'No Data'
            }
            subtitle={
              reading?.timestamp
                ? 'Last validated telemetry packet'
                : 'Sensor has not transmitted data yet'
            }
          />
        </div>

        {/* Live Reading Banner */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Live Sensor Measurement
              </p>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-5xl font-semibold tabular-nums tracking-tight text-navy">
                  {formatTemperature(reading?.temperature)}
                </span>
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {reading?.temperature !== null && reading?.temperature !== undefined
                    ? 'Actual Hardware Telemetry'
                    : connection === 'connected'
                      ? 'WAITING FOR FIRST READING'
                      : 'SENSOR DISCONNECTED'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  connection === 'connected' ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              />
              <span className="font-medium text-slate-700">{connectionLabel(connection)}</span>
            </div>
          </div>

          {connection === 'disconnected' && (
            <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500">
              Temperature data is currently unavailable because the ESP32 gateway or wearable sensor
              is offline.
            </p>
          )}
        </section>

        {/* Real Temperature History Chart */}
        <TemperatureChart readings={history} range={range} onRangeChange={setRange} />

        {/* Statistics & Hardware Detail Cards */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Session Statistics */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-semibold text-navy">Telemetry Statistics</h3>
            <p className="text-xs text-slate-400">Calculated strictly from actual received packets</p>

            <dl className="mt-4 divide-y divide-slate-100 text-xs">
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Minimum Temperature</dt>
                <dd className="font-semibold text-navy">{stats?.min ?? '--'}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Average Temperature</dt>
                <dd className="font-semibold text-navy">{stats?.avg ?? '--'}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Maximum Temperature</dt>
                <dd className="font-semibold text-navy">{stats?.max ?? '--'}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Total Packets Received</dt>
                <dd className="font-semibold text-navy">{history.length}</dd>
              </div>
            </dl>
          </section>

          {/* Athlete Profile Info */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-semibold text-navy">Athlete Profile</h3>
            <p className="text-xs text-slate-400">Team registration and discipline</p>

            <dl className="mt-4 divide-y divide-slate-100 text-xs">
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Athlete Code</dt>
                <dd className="font-semibold font-mono text-navy">{athlete.athleteId}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Sport</dt>
                <dd className="font-semibold text-navy">{athlete.sport || 'Not specified'}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Discipline / Category</dt>
                <dd className="font-semibold text-navy">{athlete.category || 'General Squad'}</dd>
              </div>
              {athlete.positionEvent ? (
                <div className="flex justify-between py-2">
                  <dt className="text-slate-500">Position / Event</dt>
                  <dd className="font-semibold text-navy">{athlete.positionEvent}</dd>
                </div>
              ) : null}
              {athlete.age ? (
                <div className="flex justify-between py-2">
                  <dt className="text-slate-500">Age</dt>
                  <dd className="font-semibold text-navy">{athlete.age} yrs</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {/* Device & Hardware Info */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-teal" />
              <h3 className="text-sm font-semibold text-navy">Hardware Status</h3>
            </div>
            <p className="text-xs text-slate-400">ESP32 gateway and ear-sensor status</p>

            <dl className="mt-4 divide-y divide-slate-100 text-xs">
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Assigned Gateway</dt>
                <dd className="font-semibold text-navy">{device?.deviceId || 'Not paired'}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Ear-Sensor ID</dt>
                <dd className="font-semibold text-navy">
                  {athlete.sensorId || <span className="text-slate-400 italic font-normal">Unassigned</span>}
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Wi-Fi Signal Strength</dt>
                <dd className="font-semibold text-navy">
                  {device?.signalStrength !== null && device?.signalStrength !== undefined
                    ? `${device.signalStrength} dBm`
                    : 'Not available'}
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Battery Level</dt>
                <dd className="font-semibold text-navy">
                  {device?.battery !== null && device?.battery !== undefined
                    ? `${device.battery}%`
                    : 'Not available'}
                </dd>
              </div>
            </dl>
          </section>

          {/* Current Session */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-teal" />
              <h3 className="text-sm font-semibold text-navy">Training Session</h3>
            </div>
            <p className="text-xs text-slate-400">Scheduled training block association</p>

            <dl className="mt-4 divide-y divide-slate-100 text-xs">
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Session Status</dt>
                <dd className="font-semibold text-navy">{session ? 'Active' : 'Not active'}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Session Name</dt>
                <dd className="font-semibold text-navy">{session?.name || '--'}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Scheduled Start</dt>
                <dd className="font-semibold text-navy">
                  {session?.date && session?.startTime
                    ? `${session.date} ${session.startTime}`
                    : '--'}
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Duration</dt>
                <dd className="font-semibold text-navy">{formatDuration(null)}</dd>
              </div>
            </dl>
          </section>
        </div>
      </main>
    </>
  )
}

function Metric({
  label,
  value,
  subtitle,
}: {
  label: string
  value: string
  subtitle?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-navy">{value}</p>
      {subtitle ? <p className="mt-1 text-[10px] text-slate-400">{subtitle}</p> : null}
    </div>
  )
}
