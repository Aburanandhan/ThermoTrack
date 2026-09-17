import { Home, Plus, Search, UserPlus, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { TopHeader } from '../components/layout/TopHeader'
import { useAppShell } from '../components/layout/useAppShell'
import { AlertPanel } from '../components/ui/AlertPanel'
import { AthleteTable } from '../components/ui/AthleteTable'
import { LiveStatusBar } from '../components/ui/LiveStatusBar'
import { getCategoriesForSport, SPORTS_CATALOGUE } from '../config/sports'
import { useAuth } from '../context/AuthContext'
import { useMonitoring } from '../context/MonitoringContext'
import {
  connectionFromDevice,
  deviceForAthlete,
  latestReadingForAthlete,
  resolveTemperatureStatus,
} from '../lib/status'
import { cn } from '../lib/cn'
import type { TemperatureStatusKey } from '../types/monitoring'

const FILTERS: { id: 'all' | TemperatureStatusKey | 'disconnected'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'good', label: 'Good' },
  { id: 'monitor', label: 'Monitor' },
  { id: 'caution', label: 'Caution' },
  { id: 'disconnected', label: 'Disconnected' },
]

export function AthletesPage() {
  const { openNav } = useAppShell()
  const { team } = useAuth()
  const { athletes, readings, devices, alerts, stream, thresholds, addAthlete } = useMonitoring()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all')
  const [search, setSearch] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  // New Athlete form state
  const [name, setName] = useState('')
  const [athleteCode, setAthleteCode] = useState('')
  const [sport, setSport] = useState(team?.sport || 'Track & Field')
  const [category, setCategory] = useState(team?.defaultCategory || 'Sprint')
  const [sensorId, setSensorId] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const categories = useMemo(() => getCategoriesForSport(sport), [sport])

  const filtered = useMemo(() => {
    return athletes.filter((athlete) => {
      // Search filter
      const matchesSearch =
        search === '' ||
        athlete.name.toLowerCase().includes(search.toLowerCase()) ||
        athlete.athleteId.toLowerCase().includes(search.toLowerCase()) ||
        (athlete.sensorId && athlete.sensorId.toLowerCase().includes(search.toLowerCase())) ||
        (athlete.sport && athlete.sport.toLowerCase().includes(search.toLowerCase())) ||
        (athlete.category && athlete.category.toLowerCase().includes(search.toLowerCase()))

      if (!matchesSearch) return false

      if (filter === 'all') return true

      const reading = latestReadingForAthlete(readings, athlete.id)
      const device = deviceForAthlete(devices, athlete)
      const connection = connectionFromDevice(device)

      if (filter === 'disconnected') {
        return connection === 'disconnected'
      }

      const temp = resolveTemperatureStatus(reading?.temperature, thresholds)
      return temp === filter
    })
  }, [athletes, devices, filter, readings, search, thresholds])

  const handleAddAthlete = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !athleteCode.trim()) {
      setFormError('Please fill in athlete name and Athlete ID.')
      return
    }

    const codeUpper = athleteCode.trim().toUpperCase()
    const duplicate = athletes.some((a) => a.athleteId.toUpperCase() === codeUpper)
    if (duplicate) {
      setFormError(`An athlete with ID "${codeUpper}" already exists in your roster.`)
      return
    }

    setIsSubmitting(true)
    setFormError(null)

    try {
      const generatedId = `ath_${Date.now()}`
      await addAthlete({
        id: generatedId,
        teamId: team?.id || null,
        name: name.trim(),
        athleteCode: codeUpper,
        sport: sport.trim() || team?.sport || 'Track & Field',
        category: category.trim() || null,
        sensorId: sensorId.trim() ? sensorId.trim().toUpperCase() : null,
        deviceId: deviceId.trim() || null,
      })

      setName('')
      setAthleteCode('')
      setSensorId('')
      setDeviceId('')
      setIsAddModalOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register athlete'
      setFormError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <TopHeader
        title="Athletes"
        subtitle="Real-time temperature monitoring and ear-sensor telemetry"
        onMenu={openNav}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal px-3 text-xs font-semibold text-white shadow-sm hover:bg-teal-dark"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add Athlete
            </button>
            <Link
              to="/"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <Home className="h-3.5 w-3.5" />
              Home
            </Link>
          </div>
        }
      />

      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-6">
        <div className="min-w-0 space-y-4">
          <LiveStatusBar devices={devices} stream={stream} />

          {/* Search & Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search athlete, code or sensor..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-teal"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Athlete filters">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition',
                    filter === item.id
                      ? 'border-navy bg-navy text-white shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <AthleteTable
            athletes={filtered}
            readings={readings}
            devices={devices}
            thresholds={thresholds}
          />
        </div>

        <div className="min-h-[320px]">
          <AlertPanel alerts={alerts} />
        </div>
      </div>

      {/* Add Athlete Modal */}
      {isAddModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-teal" />
                <h3 className="text-sm font-semibold text-navy">Register New Athlete</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddAthlete} className="mt-4 space-y-3.5">
              {formError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-600">
                  {formError}
                </p>
              ) : null}

              <div>
                <label className="block text-xs font-semibold text-navy">
                  Athlete Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jordan Miller"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                    placeholder="e.g. ATH-106"
                    value={athleteCode}
                    onChange={(e) => setAthleteCode(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-mono outline-none focus:border-teal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy">Sport</label>
                  <select
                    value={sport}
                    onChange={(e) => {
                      setSport(e.target.value)
                      const cats = getCategoriesForSport(e.target.value)
                      setCategory(cats[0] || 'General Squad')
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

              <div>
                <label className="block text-xs font-semibold text-navy">Discipline / Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs outline-none focus:border-teal"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy">
                  Wearable Sensor ID <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Assign later / No sensor assigned"
                  value={sensorId}
                  onChange={(e) => setSensorId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-mono outline-none focus:border-teal"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Sensors can be paired dynamically when physical hardware is connected.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy">Assigned ESP32 Gateway (Optional)</label>
                <select
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs outline-none focus:border-teal"
                >
                  <option value="">None / Unassigned</option>
                  <option value="ESP32_HUB_A">ESP32_HUB_A (Track Hub)</option>
                  <option value="ESP32_HUB_B">ESP32_HUB_B (Recovery Hub)</option>
                </select>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal px-4 text-xs font-semibold text-white hover:bg-teal-dark disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {isSubmitting ? 'Saving to Supabase…' : 'Add to Roster'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
