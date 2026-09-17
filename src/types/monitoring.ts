export type TemperatureBand = 'normal' | 'monitor' | 'caution'

export type TemperatureStatusKey = 'good' | 'monitor' | 'caution' | 'no_data'

export type ConnectionState = 'connected' | 'disconnected' | 'waiting'

export type AlertKind =
  | 'temperature_threshold'
  | 'rapid_increase'
  | 'sensor_disconnected'
  | 'no_data'
  | 'device_reconnected'

export type HistoryRange = '15m' | '30m' | '1h' | '3h' | 'session'

export interface TemperatureThresholds {
  normal: { min: number | null; max: number | null }
  monitor: { min: number | null; max: number | null }
  caution: { min: number | null; max: number | null }
}

export interface TeamProfile {
  id: string
  userId: string
  name: string
  coachName: string
  countryRegion?: string | null
  description?: string | null
  sport: string
  defaultCategory?: string | null
  onboardingCompleted: boolean
  createdAt: string
  updatedAt: string
}

export interface Athlete {
  id: string
  name: string
  athleteId: string
  sport?: string | null
  category?: string | null
  age?: number | null
  positionEvent?: string | null
  experienceLevel?: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  sensorId: string | null
  deviceId?: string | null
  teamId?: string | null
  userId?: string | null
  createdAt?: string
}

export interface TemperatureReading {
  athleteId: string
  sensorId: string
  temperature: number | null
  timestamp: string | null
}

export interface DeviceStatus {
  deviceId: string
  connected: boolean
  lastPacket: string | null
  signalStrength?: number | null
  battery?: number | null
  sensorId?: string | null
}

export interface MonitoringAlert {
  id: string
  kind: AlertKind
  athleteId?: string | null
  deviceId?: string | null
  message: string
  timestamp: string
}

export interface TrainingSession {
  id: string
  name: string
  date: string | null
  startTime: string | null
  athleteIds: string[]
  sensorAssignments: Record<string, string>
  monitoringSettings: MonitoringSettings
  status: 'draft' | 'scheduled' | 'active' | 'completed'
  createdAt: string
}

export interface MonitoringSettings {
  sampleIntervalSeconds: number | null
  alertOnDisconnect: boolean
  alertOnNoData: boolean
}

export interface AthleteSessionInfo {
  status: 'not_active' | 'active' | 'completed'
  startTime: string | null
  durationSeconds: number | null
}

export interface DataStreamStatus {
  connected: boolean
  lastUpdate: string | null
}

export interface UserProfile {
  name: string
  email: string
  organization: string
  role: string
}

export interface MonitoringSnapshot {
  athletes: Athlete[]
  readings: TemperatureReading[]
  devices: DeviceStatus[]
  alerts: MonitoringAlert[]
  sessions: TrainingSession[]
  stream: DataStreamStatus
  thresholds: TemperatureThresholds
}
