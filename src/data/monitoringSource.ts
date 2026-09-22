import { athleteService } from '../services/athleteService'
import { readingService } from '../services/readingService'
import { deviceService } from '../services/deviceService'
import { alertService } from '../services/alertService'
import { sessionService } from '../services/sessionService'
import { settingsService } from '../services/settingsService'
import { DEFAULT_TEMPERATURE_THRESHOLDS } from '../config/thresholds'
import { isDeviceFresh } from '../lib/status'
import type { MonitoringSnapshot } from '../types/monitoring'

export async function fetchMonitoringSnapshot(): Promise<MonitoringSnapshot> {
  try {
    const [athletes, readings, devices, alerts, sessions, thresholds] = await Promise.all([
      athleteService.getAthletes(),
      readingService.getRecentReadings(500),
      deviceService.getDevices(),
      alertService.getAlerts(50),
      sessionService.getSessions(),
      settingsService.getThresholds(),
    ])

    // Data freshness calculation: only active if readings arrived within last 60 seconds or a device reported active
    const latestReadingTime = readings.length > 0 ? readings[readings.length - 1].timestamp : null
    const hasRecentReading = Boolean(
      latestReadingTime &&
      Date.now() - Date.parse(latestReadingTime) < 60 * 1000
    )
    const anyConnectedDevice = devices.some((device) => isDeviceFresh(device))

    return {
      athletes,
      readings,
      devices,
      alerts,
      sessions,
      stream: {
        connected: anyConnectedDevice || hasRecentReading,
        lastUpdate: latestReadingTime,
      },
      thresholds,
    }
  } catch (err) {
    console.error('Failed to fetch real monitoring snapshot from Supabase:', err)
    return {
      athletes: [],
      readings: [],
      devices: [],
      alerts: [],
      sessions: [],
      stream: { connected: false, lastUpdate: null },
      thresholds: DEFAULT_TEMPERATURE_THRESHOLDS,
    }
  }
}
