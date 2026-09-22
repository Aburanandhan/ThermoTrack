import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { isDeviceFresh } from '../lib/status'
import type { DeviceStatus } from '../types/monitoring'

interface DbDeviceRow {
  id: string
  device_id?: string | null
  connected: boolean
  last_packet?: string | null
  last_seen_at?: string | null
  signal_strength: number | null
  battery: number | null
  sensor_id: string | null
  athlete_id?: string | null
  device_type?: string | null
}

export const deviceService = {
  async getDevices(): Promise<DeviceStatus[]> {
    if (!isSupabaseConfigured) return []

    const { data, error } = await supabase
      .from('thermo_devices')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching devices:', error.message)
      throw error
    }

    return ((data || []) as unknown as DbDeviceRow[]).map((row) => ({
      deviceId: row.device_id || row.id,
      connected: isDeviceFresh({ lastSeenAt: row.last_seen_at ?? null }),
      lastSeenAt: row.last_seen_at || null,
      lastPacket: row.last_packet ?? row.last_seen_at ?? null,
      signalStrength: row.signal_strength !== null ? Number(row.signal_strength) : null,
      battery: row.battery !== null ? Number(row.battery) : null,
      sensorId: row.sensor_id,
    }))
  },
}
