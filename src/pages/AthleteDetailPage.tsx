import { ArrowLeft, CheckCircle2, Cpu, Edit3, Radio, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { TopHeader } from '../components/layout/TopHeader'
import { useAppShell } from '../components/layout/useAppShell'
import { ConnectionStatus } from '../components/ui/ConnectionStatus'
import { EmptyState } from '../components/ui/EmptyState'
import { TemperatureChart } from '../components/ui/TemperatureChart'
import { TemperatureStatus } from '../components/ui/TemperatureStatus'
import { SPORTS_CATALOGUE, getCategoriesForSport } from '../config/sports'
import { useMonitoring } from '../context/MonitoringContext'
import { formatDuration, formatTemperature, formatTimestamp } from '../lib/format'
import {
  connectionFromDevice,
  connectionLabel,
  deviceForAthlete,
  latestReadingForAthlete,
  resolveTemperatureStatus,
} from '../lib/status'
import { cn } from '../lib/cn'
import type { HistoryRange } from '../types/monitoring'

export function AthleteDetailPage() {
  const { openNav } = useAppShell()
  const { athleteId } = useParams()
  const { athletes, readings, devices, thresholds, sessions, updateAthlete } = useMonitoring()
  const [range, setRange] = useState<HistoryRange>('15m')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const athlete = athletes.find((item) => item.id === athleteId)
  const reading = athlete ? latestReadingForAthlete(readings, athlete.id, athlete.sensorId) : undefined
  const device = athlete ? deviceForAthlete(devices, athlete) : undefined
  const connection = connectionFromDevice(device)
  const tempStatus = resolveTemperatureStatus(reading?.temperature, thresholds)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editAthleteCode, setEditAthleteCode] = useState('')
  const [editSport, setEditSport] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editAge, setEditAge] = useState('')
  const [editPositionEvent, setEditPositionEvent] = useState('')
  const [editSensorId, setEditSensorId] = useState('')
  const [editDeviceId, setEditDeviceId] = useState('')
  const [isEditSubmitting, setIsEditSubmitting] = useState(false)
  const [editFormError, setEditFormError] = useState<string | null>(null)

  const editCategories = useMemo(() => getCategoriesForSport(editSport), [editSport])

  const handleOpenEdit = () => {
    if (!athlete) return
    setEditName(athlete.name)
    setEditAthleteCode(athlete.athleteId)
    setEditSport(athlete.sport || 'Track & Field')
    setEditCategory(athlete.category || 'General Squad')
    setEditAge(athlete.age !== null && athlete.age !== undefined ? String(athlete.age) : '')
    setEditPositionEvent(athlete.positionEvent || '')
    setEditSensorId(athlete.sensorId || '')
    setEditDeviceId(athlete.deviceId || '')
    setEditFormError(null)
    setIsEditModalOpen(true)
  }

  const handleSaveAthlete = async (e: FormEvent) => {
    e.preventDefault()
    if (!athlete) return

    if (!editName.trim() || !editAthleteCode.trim()) {
      setEditFormError('Please fill in athlete name and Athlete ID.')
      return
    }

    const codeUpper = editAthleteCode.trim().toUpperCase()
    const duplicate = athletes.some(
      (a) => a.id !== athlete.id && a.athleteId.toUpperCase() === codeUpper,
    )
    if (duplicate) {
      setEditFormError(`An athlete with ID "${codeUpper}" already exists in the roster.`)
      return
    }

    setIsEditSubmitting(true)
    setEditFormError(null)

    try {
      await updateAthlete(athlete.id, {
        name: editName.trim(),
        athleteCode: codeUpper,
        sport: editSport.trim() || null,
        category: editCategory.trim() || null,
        age: editAge.trim() ? parseInt(editAge.trim(), 10) : null,
        positionEvent: editPositionEvent.trim() || null,
        sensorId: editSensorId.trim() ? editSensorId.trim().toUpperCase() : null,
        deviceId: editDeviceId.trim() ? editDeviceId.trim().toUpperCase() : null,
      })

      setIsEditModalOpen(false)
      setFeedback({
        type: 'success',
        message: 'Hardware assignment and profile saved successfully.',
      })
      setTimeout(() => setFeedback(null), 5000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update athlete'
      setEditFormError(msg)
    } finally {
      setIsEditSubmitting(false)
    }
  }

  const history = useMemo(
    () =>
      athlete
        ? readings.filter(
            (item) =>
              item.athleteId === athlete.id ||
              (athlete.sensorId && item.sensorId === athlete.sensorId),
          )
        : [],
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
        subtitle={`${athlete.athleteId} · Sensor: ${athlete.sensorId || 'Unassigned'} · Device: ${athlete.deviceId || 'Unassigned'}`}
        onMenu={openNav}
        actions={
          <button
            type="button"
            onClick={handleOpenEdit}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-dark"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit Hardware Assignment
          </button>
        }
      />
      <main className="space-y-5 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <Link
            to="/athletes"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Athletes
          </Link>

          <button
            type="button"
            onClick={handleOpenEdit}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-teal sm:hidden"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit Hardware
          </button>
        </div>

        {feedback ? (
          <div
            className={cn(
              'flex items-center justify-between rounded-lg border p-3 text-xs',
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800',
            )}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

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
              {athlete.deviceId ? `Gateway: ${athlete.deviceId}` : device?.deviceId ? `Gateway: ${device.deviceId}` : 'Waiting for device pairing'}
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
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-navy">Athlete Profile</h3>
                <p className="text-xs text-slate-400">Team registration and discipline</p>
              </div>
              <button
                type="button"
                onClick={handleOpenEdit}
                className="text-xs font-medium text-teal hover:underline"
              >
                Edit Profile
              </button>
            </div>

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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-teal" />
                <h3 className="text-sm font-semibold text-navy">Hardware Status</h3>
              </div>
              <button
                type="button"
                onClick={handleOpenEdit}
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal hover:underline"
              >
                <Edit3 className="h-3 w-3" />
                Edit Hardware
              </button>
            </div>
            <p className="text-xs text-slate-400">ESP8266/ESP32 gateway and ear-sensor status</p>

            <dl className="mt-4 divide-y divide-slate-100 text-xs">
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Assigned Gateway (Device ID)</dt>
                <dd className="font-semibold font-mono text-navy">
                  {athlete.deviceId ? athlete.deviceId : device?.deviceId ? device.deviceId : <span className="text-slate-400 italic font-normal font-sans">Not Assigned</span>}
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Ear-Sensor ID</dt>
                <dd className="font-semibold font-mono text-navy">
                  {athlete.sensorId ? athlete.sensorId : <span className="text-slate-400 italic font-normal font-sans">Not Assigned</span>}
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

      {/* Edit Athlete Modal */}
      {isEditModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-teal" />
                <h3 className="text-sm font-semibold text-navy">
                  Edit Athlete & Hardware: {athlete.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAthlete} className="mt-4 space-y-3.5">
              {editFormError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-600">
                  {editFormError}
                </p>
              ) : null}

              <div>
                <label className="block text-xs font-semibold text-navy">
                  Athlete Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KAJA"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-teal"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-navy">
                    Athlete ID Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ATH-101"
                    value={editAthleteCode}
                    onChange={(e) => setEditAthleteCode(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-mono outline-none focus:border-teal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy">Sport</label>
                  <select
                    value={editSport}
                    onChange={(e) => {
                      setEditSport(e.target.value)
                      const cats = getCategoriesForSport(e.target.value)
                      setEditCategory(cats[0] || 'General Squad')
                    }}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs outline-none focus:border-teal"
                  >
                    {SPORTS_CATALOGUE.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-navy">Discipline / Category</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs outline-none focus:border-teal"
                  >
                    {editCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy">Age (Optional)</label>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    placeholder="e.g. 24"
                    value={editAge}
                    onChange={(e) => setEditAge(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-teal"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy">Position / Event (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 100m / Sprint"
                  value={editPositionEvent}
                  onChange={(e) => setEditPositionEvent(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-teal"
                />
              </div>

              <div className="rounded-lg border border-teal/20 bg-teal/5 p-3 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-navy">
                  <Cpu className="h-3.5 w-3.5 text-teal" />
                  Hardware Assignment
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-700">
                    Sensor ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TEMP-001 (Leave blank to remove)"
                    value={editSensorId}
                    onChange={(e) => setEditSensorId(e.target.value)}
                    className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono outline-none focus:border-teal"
                  />
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    ESP8266 reports this sensor_id to route telemetry to this athlete.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-700">
                    Device ID / Gateway
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. THERMO-001 (Leave blank to remove)"
                    value={editDeviceId}
                    onChange={(e) => setEditDeviceId(e.target.value)}
                    className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono outline-none focus:border-teal"
                  />
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    Gateway or microcontroller ID (persisted to thermo_athletes.device_id).
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditSubmitting}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal px-4 text-xs font-semibold text-white hover:bg-teal-dark disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {isEditSubmitting ? 'Saving Changes…' : 'Save Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
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
