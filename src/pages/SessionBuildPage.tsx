import { Calendar, CheckCircle2, Plus } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TopHeader } from '../components/layout/TopHeader'
import { useAppShell } from '../components/layout/useAppShell'
import { EmptyState } from '../components/ui/EmptyState'
import { useMonitoring } from '../context/MonitoringContext'
import type { MonitoringSettings, TrainingSession } from '../types/monitoring'

export function SessionBuildPage() {
  const { openNav } = useAppShell()
  const navigate = useNavigate()
  const { athletes, addSession } = useMonitoring()
  const [name, setName] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState('09:00')
  const [selected, setSelected] = useState<string[]>([])
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [interval, setInterval] = useState('5')
  const [alertDisconnect, setAlertDisconnect] = useState(true)
  const [alertNoData, setAlertNoData] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [created, setCreated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const settings: MonitoringSettings = useMemo(
    () => ({
      sampleIntervalSeconds: interval ? Number(interval) : null,
      alertOnDisconnect: alertDisconnect,
      alertOnNoData: alertNoData,
    }),
    [alertDisconnect, alertNoData, interval],
  )

  const selectAllAthletes = () => {
    if (selected.length === athletes.length) {
      setSelected([])
    } else {
      setSelected(athletes.map((a) => a.id))
      const autoAssign: Record<string, string> = {}
      athletes.forEach((a) => {
        autoAssign[a.id] = a.sensorId || ''
      })
      setAssignments(autoAssign)
    }
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('Enter a session name.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const session: TrainingSession = {
        id: crypto.randomUUID(),
        name: name.trim(),
        date: date || null,
        startTime: startTime || null,
        athleteIds: selected,
        sensorAssignments: assignments,
        monitoringSettings: settings,
        status: 'scheduled',
        createdAt: new Date().toISOString(),
      }

      await addSession(session)
      setCreated(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save session to Supabase'
      setError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <TopHeader
        title="Session Build"
        subtitle="Configure a training session and assign ear-temperature sensors"
        onMenu={openNav}
        actions={
          <Link
            to="/calendar"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <Calendar className="h-3.5 w-3.5" />
            Calendar
          </Link>
        }
      />
      <main className="p-4 sm:p-6">
        <div className="mx-auto max-w-3xl">
          {created ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-6 shadow-sm text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
              <h2 className="mt-3 text-lg font-semibold text-emerald-950">
                Session Successfully Created!
              </h2>
              <p className="mt-1 text-sm text-emerald-800">
                The training session & sensor assignments have been persisted to your Supabase backend.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/calendar')}
                  className="rounded-lg bg-teal px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-dark"
                >
                  View in Calendar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreated(false)
                    setName('')
                    setSelected([])
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Create Another Session
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-6">
              {error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                  {error}
                </p>
              ) : null}

              {/* Basic Session Details */}
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-navy">Session Information</h2>
                <label className="mt-4 block">
                  <span className="text-xs font-semibold text-navy">Session Name *</span>
                  <input
                    required
                    placeholder="e.g. Afternoon High-Altitude Conditioning"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-teal"
                  />
                </label>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold text-navy">Session Date</span>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-teal"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-navy">Scheduled Start Time</span>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-teal"
                    />
                  </label>
                </div>
              </section>

              {/* Athlete Assignment */}
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-navy">Assign Athletes & Sensors</h2>
                    <p className="text-xs text-slate-500">
                      {selected.length} of {athletes.length} athletes selected
                    </p>
                  </div>
                  {athletes.length > 0 ? (
                    <button
                      type="button"
                      onClick={selectAllAthletes}
                      className="text-xs font-semibold text-teal hover:underline"
                    >
                      {selected.length === athletes.length ? 'Deselect All' : 'Select All'}
                    </button>
                  ) : null}
                </div>

                {athletes.length === 0 ? (
                  <EmptyState
                    className="mt-4"
                    title="No athletes available"
                    description="Add athletes from the Athletes page first before building a session."
                  />
                ) : (
                  <ul className="mt-3 divide-y divide-slate-100">
                    {athletes.map((athlete) => {
                      const checked = selected.includes(athlete.id)
                      return (
                        <li key={athlete.id} className="py-2.5">
                          <label className="flex items-center gap-3 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                if (checked) {
                                  setSelected((curr) => curr.filter((id) => id !== athlete.id))
                                } else {
                                  setSelected((curr) => [...curr, athlete.id])
                                  setAssignments((curr) => ({
                                    ...curr,
                                    [athlete.id]: curr[athlete.id] || athlete.sensorId || '',
                                  }))
                                }
                              }}
                              className="rounded border-slate-300 text-teal focus:ring-teal"
                            />
                            <div>
                              <span className="font-semibold text-navy">{athlete.name}</span>
                              <span className="ml-2 text-slate-400">({athlete.athleteId})</span>
                            </div>
                          </label>

                          {checked ? (
                            <div className="mt-2 ml-6 flex items-center gap-2">
                              <span className="text-[11px] text-slate-500">Wearable Sensor:</span>
                              <input
                                placeholder="Sensor ID or leave empty"
                                value={assignments[athlete.id] ?? (athlete.sensorId || '')}
                                onChange={(e) =>
                                  setAssignments((curr) => ({
                                    ...curr,
                                    [athlete.id]: e.target.value,
                                  }))
                                }
                                className="h-7 w-48 rounded border border-slate-200 px-2 text-xs font-mono"
                              />
                            </div>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              {/* Telemetry Settings */}
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-navy">Monitoring Rules & Cadence</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-navy">
                    Sampling Interval (seconds)
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={interval}
                      onChange={(e) => setInterval(e.target.value)}
                      placeholder="e.g. 5"
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-teal"
                    />
                  </label>
                </div>

                <div className="mt-4 space-y-2">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={alertDisconnect}
                      onChange={(e) => setAlertDisconnect(e.target.checked)}
                      className="rounded border-slate-300 text-teal focus:ring-teal"
                    />
                    Trigger alert when ESP32 or ear sensor disconnects
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={alertNoData}
                      onChange={(e) => setAlertNoData(e.target.checked)}
                      className="rounded border-slate-300 text-teal focus:ring-teal"
                    />
                    Trigger alert when packet stream pauses for more than 15 seconds
                  </label>
                </div>
              </section>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal px-6 text-xs font-semibold text-white shadow-sm hover:bg-teal-dark disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {isSubmitting ? 'Saving to Supabase…' : 'Schedule Training Session'}
              </button>
            </form>
          )}
        </div>
      </main>
    </>
  )
}
