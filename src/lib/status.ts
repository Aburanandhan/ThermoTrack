import type {
  ConnectionState,
  DeviceStatus,
  TemperatureReading,
  TemperatureStatusKey,
  TemperatureThresholds,
} from '../types/monitoring'

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
  return device.connected ? 'connected' : 'disconnected'
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
  return readings
    .filter((reading) => reading.athleteId === athleteId || (sensorId && reading.sensorId === sensorId))
    .sort((a, b) => {
      const aTime = a.timestamp ? Date.parse(a.timestamp) : 0
      const bTime = b.timestamp ? Date.parse(b.timestamp) : 0
      return bTime - aTime
    })[0]
}

export function deviceForAthlete(
  devices: DeviceStatus[],
  athlete: { deviceId?: string | null; sensorId?: string | null },
): DeviceStatus | undefined {
  if (athlete.deviceId) {
    const byId = devices.find((device) => device.deviceId === athlete.deviceId)
    if (byId) return byId
  }
  if (athlete.sensorId) {
    return devices.find((device) => device.sensorId === athlete.sensorId)
  }
  return undefined
}
