import type { TemperatureThresholds } from '../types/monitoring'

/**
 * Threshold bands are configuration, not medical diagnosis.
 * Values remain unset until the backend/admin supplies them.
 */
export const DEFAULT_TEMPERATURE_THRESHOLDS: TemperatureThresholds = {
  normal: { min: 36.0, max: 37.5 },
  monitor: { min: 37.5, max: 38.5 },
  caution: { min: 38.5, max: 40.0 },
}

export const EMPTY_MONITORING_SNAPSHOT = {
  athletes: [] as const,
  readings: [] as const,
  devices: [] as const,
  alerts: [] as const,
  sessions: [] as const,
  stream: { connected: false, lastUpdate: null },
} as const
