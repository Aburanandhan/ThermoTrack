import type {
  ConnectionState,
  DeviceStatus,
  TemperatureReading,
  TemperatureStatusKey,
  TemperatureThresholds,
} from '../types/monitoring'

export const CONNECTION_TIMEOUT_MS = 30 * 1000
export const DEVICE_FRESHNESS_THRESHOLD_MS = CONNECTION_TIMEOUT_MS

export function isDeviceFresh(
  device: Pick<DeviceStatus, 'lastSeenAt'> | { last_seen_at?: string | null; lastSeenAt?: string | null } | undefined | null,
  now = Date.now(),
): boolean {
  if (!device) return false
  const rawTimestamp =
    ('lastSeenAt' in device ? device.lastSeenAt : undefined) ??
    ('last_seen_at' in device ? device.last_seen_at : undefined)
  if (!rawTimestamp) return false
  const lastSeenMs = new Date(rawTimestamp).getTime()
  if (!Number.isFinite(lastSeenMs) || Number.isNaN(lastSeenMs)) return false
  const ageMs = now - lastSeenMs
  // Connected if current time - last_seen_at <= 30 seconds (tolerating slight future clock skew up to 60s)
  return ageMs >= -60_000 && ageMs <= CONNECTION_TIMEOUT_MS
}

export function resolveTemperatureStatus(
  temperature: number | null | undefined,
  thresholds: TemperatureThresholds,
): TemperatureStatusKey {
  if (temperature === null || temperature === undefined || Number.isNaN(temperature)) {
    return 'no_data'
  }

  const inBand = (band: TemperatureThresholds[keyof TemperatureThresholds]) => {
    if (band.min === null && band.max === null) return false
    if (band.min !== null && temperature < band.min) return false
    if (band.max !== null && temperature > band.max) return false
    return true
  }

  if (inBand(thresholds.caution)) return 'caution'
  if (inBand(thresholds.monitor)) return 'monitor'
  if (inBand(thresholds.normal)) return 'good'
  return 'no_data'
}

export function temperatureStatusLabel(status: TemperatureStatusKey): string {
  switch (status) {
    case 'good':
      return 'Good'
    case 'monitor':
      return 'Monitor'
    case 'caution':
      return 'Caution'
    default:
      return 'No Data'
  }
}

export function connectionFromDevice(device: DeviceStatus | undefined): ConnectionState {
  if (!device) return 'waiting'
  return isDeviceFresh(device) ? 'connected' : 'disconnected'
}

export function connectionLabel(state: ConnectionState): string {
  switch (state) {
    case 'connected':
      return 'Connected'
    case 'disconnected':
      return 'Disconnected'
    default:
      return 'Waiting for device'
  }
}

export function latestReadingForAthlete(
  readings: TemperatureReading[],
  athleteId: string,
  sensorId?: string | null,
): TemperatureReading | undefined {
  const normSensorId = sensorId?.trim().toUpperCase()
  return readings
    .filter((reading) => {
      if (reading.athleteId === athleteId) return true
      if (normSensorId && reading.sensorId?.trim().toUpperCase() === normSensorId) return true
      return false
    })
    .sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0
      return bTime - aTime
    })[0]
}

export function deviceForAthlete(
  devices: DeviceStatus[],
  athlete: { deviceId?: string | null; sensorId?: string | null },
): DeviceStatus | undefined {
  if (athlete.deviceId) {
    const targetDeviceId = athlete.deviceId.trim().toUpperCase()
    const byId = devices.find(
      (device) => device.deviceId.trim().toUpperCase() === targetDeviceId,
    )
    if (byId) return byId
  }
  if (athlete.sensorId) {
    const targetSensorId = athlete.sensorId.trim().toUpperCase()
    const bySensor = devices.find(
      (device) => device.sensorId && device.sensorId.trim().toUpperCase() === targetSensorId,
    )
    if (bySensor) return bySensor
  }
  return undefined
}
