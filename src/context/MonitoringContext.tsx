import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchMonitoringSnapshot } from '../data/monitoringSource'
import { athleteService, type AthleteInput } from '../services/athleteService'
import { sessionService } from '../services/sessionService'
import { alertService } from '../services/alertService'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { DEFAULT_TEMPERATURE_THRESHOLDS } from '../config/thresholds'
import { isDeviceFresh } from '../lib/status'
import type {
  Athlete,
  DataStreamStatus,
  DeviceStatus,
  MonitoringAlert,
  TemperatureReading,
  TemperatureThresholds,
  TrainingSession,
} from '../types/monitoring'

interface MonitoringContextValue {
  athletes: Athlete[]
  readings: TemperatureReading[]
  devices: DeviceStatus[]
  alerts: MonitoringAlert[]
  sessions: TrainingSession[]
  stream: DataStreamStatus
  thresholds: TemperatureThresholds
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  addSession: (session: TrainingSession) => Promise<void>
  addAthlete: (athlete: AthleteInput) => Promise<Athlete>
  updateAthlete: (athleteId: string, athlete: Partial<AthleteInput>) => Promise<Athlete>
  dismissAlert: (alertId: string) => Promise<void>
}

const MonitoringContext = createContext<MonitoringContextValue | null>(null)

export function MonitoringProvider({ children }: { children: ReactNode }) {
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [readings, setReadings] = useState<TemperatureReading[]>([])
  const [devices, setDevices] = useState<DeviceStatus[]>([])
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([])
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [stream, setStream] = useState<DataStreamStatus>({
    connected: false,
    lastUpdate: null,
  })
  const [thresholds, setThresholds] = useState<TemperatureThresholds>(
    DEFAULT_TEMPERATURE_THRESHOLDS,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const snapshot = await fetchMonitoringSnapshot()
      setAthletes(snapshot.athletes)
      setReadings(snapshot.readings)
      setDevices(snapshot.devices)
      setAlerts(snapshot.alerts)
      setSessions(snapshot.sessions)
      setStream(snapshot.stream)
      setThresholds(snapshot.thresholds)
    } catch {
      setError('Unable to load monitoring data. Please check your backend connection.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const checkDeviceFreshness = () => {
      setDevices((current) =>
        current.map((device) => ({
          ...device,
          connected: isDeviceFresh(device),
        })),
      )
    }

    const timer = window.setInterval(checkDeviceFreshness, 5 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    setStream((current) => ({
      ...current,
      connected: devices.some((device) => isDeviceFresh(device)),
    }))
  }, [devices])

  // Realtime Supabase Channel subscriptions - Real Hardware Telemetry Only
  useEffect(() => {
    if (!isSupabaseConfigured) return

    const channel = supabase
      .channel('thermo_hardware_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'thermo_readings' },
        (payload) => {
          const row = payload.new as {
            athlete_id: string
            sensor_id: string
            temperature?: number | null
            temperature_c?: number | null
            timestamp?: string | null
            recorded_at?: string | null
            created_at?: string | null
          }
          const rawTemp = row.temperature !== null && row.temperature !== undefined
            ? row.temperature
            : row.temperature_c
          if (rawTemp === null || rawTemp === undefined) return

          const rawTime = row.timestamp || row.recorded_at || row.created_at || new Date().toISOString()

          const newReading: TemperatureReading = {
            athleteId: row.athlete_id,
            sensorId: row.sensor_id,
            temperature: Number(rawTemp),
            timestamp: rawTime,
          }

          setReadings((curr) => [...curr.slice(-499), newReading])
          setStream((current) => ({ ...current, lastUpdate: rawTime }))
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'thermo_devices' },
        (payload) => {
          const row = payload.new as {
            id?: string
            device_id?: string
            connected?: boolean
            last_packet?: string | null
            last_seen_at?: string | null
            signal_strength: number | null
            battery: number | null
            sensor_id: string | null
          }
          const devId = row.device_id || row.id
          if (!devId) return

          setDevices((curr) => {
            const index = curr.findIndex((d) => d.deviceId === devId)
            const item: DeviceStatus = {
              deviceId: devId,
              connected: isDeviceFresh({ lastSeenAt: row.last_seen_at ?? null }),
              lastSeenAt: row.last_seen_at || null,
              lastPacket: row.last_packet ?? row.last_seen_at ?? null,
              signalStrength: row.signal_strength !== null ? Number(row.signal_strength) : null,
              battery: row.battery !== null ? Number(row.battery) : null,
              sensorId: row.sensor_id,
            }
            if (index >= 0) {
              const copy = [...curr]
              copy[index] = item
              return copy
            }
            return [...curr, item]
          })
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'thermo_alerts' },
        (payload) => {
          const row = payload.new as {
            id: string
            kind?: string
            alert_type?: string
            athlete_id: string | null
            device_id: string | null
            message: string
            timestamp?: string
            created_at?: string
            acknowledged: boolean
          }
          if (row.acknowledged) return

          const newAlert: MonitoringAlert = {
            id: row.id,
            kind: (row.kind || row.alert_type || 'temperature_threshold') as MonitoringAlert['kind'],
            athleteId: row.athlete_id,
            deviceId: row.device_id,
            message: row.message,
            timestamp: row.timestamp || row.created_at || new Date().toISOString(),
          }
          setAlerts((curr) => [newAlert, ...curr.filter((a) => a.id !== newAlert.id)])
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'thermo_alerts' },
        (payload) => {
          const row = payload.new as { id: string; acknowledged: boolean }
          if (row?.acknowledged) {
            setAlerts((curr) => curr.filter((a) => a.id !== row.id))
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'thermo_athletes' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { id?: string }
            if (oldRow?.id) {
              setAthletes((curr) => curr.filter((a) => a.id !== oldRow.id))
            }
            return
          }

          const row = payload.new as {
            id: string
            name: string
            athlete_code: string
            sensor_id: string | null
            device_id: string | null
            team_id?: string | null
            sport?: string | null
            category?: string | null
            age?: number | null
            position_event?: string | null
            experience_level?: string | null
            emergency_contact_name?: string | null
            emergency_contact_phone?: string | null
            created_at?: string
          }
          if (!row?.id) return

          setAthletes((curr) => {
            const index = curr.findIndex((a) => a.id === row.id)
            const item: Athlete = {
              id: row.id,
              name: row.name,
              athleteId: row.athlete_code,
              sensorId: row.sensor_id || null,
              deviceId: row.device_id || null,
              teamId: row.team_id || null,
              sport: row.sport || null,
              category: row.category || null,
              age: row.age ?? null,
              positionEvent: row.position_event || null,
              experienceLevel: row.experience_level || null,
              emergencyContactName: row.emergency_contact_name || null,
              emergencyContactPhone: row.emergency_contact_phone || null,
              createdAt: row.created_at,
            }
            if (index >= 0) {
              const copy = [...curr]
              copy[index] = { ...copy[index], ...item }
              return copy
            }
            return [...curr, item]
          })
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'thermo_sessions' },
        (payload) => {
          const row = payload.new as {
            id: string
            name: string
            date: string | null
            start_time: string | null
            athlete_ids: string[] | null
            sensor_assignments: Record<string, string> | null
            monitoring_settings: Record<string, unknown> | null
            status: TrainingSession['status']
            created_at: string
          }
          if (!row?.id) return

          const newSession: TrainingSession = {
            id: row.id,
            name: row.name,
            date: row.date,
            startTime: row.start_time,
            athleteIds: Array.isArray(row.athlete_ids) ? row.athlete_ids : [],
            sensorAssignments: row.sensor_assignments || {},
            monitoringSettings: {
              sampleIntervalSeconds: (row.monitoring_settings?.sampleIntervalSeconds as number) ?? null,
              alertOnDisconnect: Boolean(row.monitoring_settings?.alertOnDisconnect ?? true),
              alertOnNoData: Boolean(row.monitoring_settings?.alertOnNoData ?? true),
            },
            status: row.status || 'scheduled',
            createdAt: row.created_at,
          }
          setSessions((curr) => [newSession, ...curr.filter((s) => s.id !== newSession.id)])
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  const addSession = useCallback(async (session: TrainingSession) => {
    await sessionService.createSession(session)
    setSessions((current) => [session, ...current])
  }, [])

  const addAthlete = useCallback(async (newAthlete: AthleteInput): Promise<Athlete> => {
    const athlete = await athleteService.addAthlete(newAthlete)
    setAthletes((curr) => [...curr, athlete])
    return athlete
  }, [])

  const updateAthlete = useCallback(
    async (athleteId: string, updates: Partial<AthleteInput>): Promise<Athlete> => {
      const updated = await athleteService.updateAthlete(athleteId, updates)
      setAthletes((curr) => curr.map((a) => (a.id === athleteId ? { ...a, ...updated } : a)))
      return updated
    },
    [],
  )

  const dismissAlert = useCallback(async (alertId: string) => {
    setAlerts((curr) => curr.filter((a) => a.id !== alertId))
    await alertService.acknowledgeAlert(alertId).catch((err) => {
      console.error('Failed to dismiss alert:', err)
    })
  }, [])

  const value = useMemo<MonitoringContextValue>(
    () => ({
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
      addSession,
      addAthlete,
      updateAthlete,
      dismissAlert,
    }),
    [
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
      addSession,
      addAthlete,
      updateAthlete,
      dismissAlert,
    ],
  )

  return <MonitoringContext.Provider value={value}>{children}</MonitoringContext.Provider>
}

export function useMonitoring() {
  const ctx = useContext(MonitoringContext)
  if (!ctx) throw new Error('useMonitoring must be used within MonitoringProvider')
  return ctx
}
