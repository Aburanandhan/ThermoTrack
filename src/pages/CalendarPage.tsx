import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Users,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { TopHeader } from '../components/layout/TopHeader'
import { useAppShell } from '../components/layout/useAppShell'
import { EmptyState } from '../components/ui/EmptyState'
import { useMonitoring } from '../context/MonitoringContext'
import type { TrainingSession } from '../types/monitoring'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarPage() {
  const { openNav } = useAppShell()
  const { sessions, athletes } = useMonitoring()
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null)
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const days = useMemo(() => buildMonth(cursor), [cursor])
  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  const getAthleteName = (id: string) => {
    const ath = athletes.find((a) => a.id === id)
    return ath ? `${ath.name} (${ath.athleteId})` : id
  }

  return (
    <>
      <TopHeader
        title="Calendar"
        subtitle="Training sessions, monitoring windows, and sensor schedules"
        onMenu={openNav}
        actions={
          <Link
            to="/session-build"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal px-3 text-xs font-semibold text-white shadow-sm hover:bg-teal-dark"
          >
            <Plus className="h-3.5 w-3.5" />
            Build Session
          </Link>
        }
      />
      <main className="space-y-6 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy">{monthLabel}</h2>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Current month"
              onClick={() => {
                const now = new Date()
                setCursor(new Date(now.getFullYear(), now.getMonth(), 1))
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, index) => {
              const key = day ? toKey(day) : ''
              const daySessions = day ? sessions.filter((session) => session.date === key) : []
              const isToday =
                day &&
                day.getDate() === new Date().getDate() &&
                day.getMonth() === new Date().getMonth() &&
                day.getFullYear() === new Date().getFullYear()

              return (
                <div
                  key={day ? key : `empty-${index}`}
                  className={`min-h-[105px] border-t border-r last:border-r-0 border-slate-100 p-2 text-sm transition ${
                    isToday ? 'bg-teal/5 font-semibold' : ''
                  }`}
                >
                  {day ? (
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                        isToday ? 'bg-teal text-white' : 'text-slate-600'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  ) : null}
                  <div className="mt-1 space-y-1">
                    {daySessions.map((session) => (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => setSelectedSession(session)}
                        className="w-full text-left truncate rounded bg-teal/15 px-1.5 py-1 text-[11px] font-medium text-teal-dark hover:bg-teal/25 transition"
                      >
                        {session.name}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Upcoming Sessions List */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-navy">All Scheduled Sessions</h3>
            <span className="text-xs text-slate-500">{sessions.length} total</span>
          </div>

          {sessions.length === 0 ? (
            <EmptyState
              className="mt-3"
              title="No sessions scheduled"
              description="Training and monitoring sessions will appear here when they are created."
            />
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className="cursor-pointer rounded-xl border border-slate-200 p-4 shadow-xs transition hover:border-teal/50 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        session.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {session.status}
                    </span>
                    <span className="text-xs text-slate-400">
                      {session.date ?? 'Date unassigned'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-navy">{session.name}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {session.startTime || '09:00'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {session.athleteIds?.length || 0} Athletes
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* Session Details Modal */}
      {selectedSession ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-teal" />
                <h3 className="text-sm font-semibold text-navy">{selectedSession.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSession(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-3">
                <div>
                  <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    Scheduled Date & Time
                  </p>
                  <p className="mt-1 font-medium text-navy text-sm">
                    {selectedSession.date || 'Today'} at {selectedSession.startTime || '--:--'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    Status
                  </p>
                  <p className="mt-1 font-semibold uppercase text-teal-dark">
                    {selectedSession.status}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-navy">Assigned Athletes & Sensors</h4>
                {selectedSession.athleteIds && selectedSession.athleteIds.length > 0 ? (
                  <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-100 p-2">
                    {selectedSession.athleteIds.map((athId) => (
                      <li key={athId} className="flex items-center justify-between py-1.5">
                        <span className="font-medium text-slate-800">{getAthleteName(athId)}</span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                          {selectedSession.sensorAssignments?.[athId] || 'Ear Sensor'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-slate-500">No athletes assigned to this session.</p>
                )}
              </div>

              <div>
                <h4 className="font-semibold text-navy">Monitoring Settings</h4>
                <div className="mt-1 text-slate-600 space-y-1">
                  <p>
                    • Sampling Cadence:{' '}
                    {selectedSession.monitoringSettings?.sampleIntervalSeconds ?? 5}s
                  </p>
                  <p>
                    • Disconnect Alert:{' '}
                    {selectedSession.monitoringSettings?.alertOnDisconnect ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSession(null)}
                className="h-9 rounded-lg bg-navy px-4 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function buildMonth(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
  const cells: Array<Date | null> = []
  for (let i = 0; i < first.getDay(); i += 1) cells.push(null)
  for (let d = 1; d <= last.getDate(); d += 1) {
    cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function toKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
