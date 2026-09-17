import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { TemperatureReading } from '../types/monitoring'

interface DbReadingRow {
  id: string
  athlete_id: string
  sensor_id: string
  temperature: number | null
  temperature_c?: number | null
  timestamp: string | null
  recorded_at?: string | null
  created_at?: string | null
  device_id?: string | null
}

export const readingService = {
  async getRecentReadings(limit = 500): Promise<TemperatureReading[]> {
    if (!isSupabaseConfigured) return []

    const { data, error } = await supabase
      .from('thermo_readings')
      .select('*')
      .order('timestamp', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('Error fetching temperature readings:', error.message)
      throw error
    }

    return ((data || []) as unknown as DbReadingRow[]).map((row) => {
      const tempVal = row.temperature !== null && row.temperature !== undefined
        ? Number(row.temperature)
        : (row.temperature_c !== null && row.temperature_c !== undefined ? Number(row.temperature_c) : null)

      return {
        athleteId: row.athlete_id,
        sensorId: row.sensor_id,
        temperature: tempVal,
        timestamp: row.timestamp || row.recorded_at || row.created_at || null,
      }
    })
  },

  async getReadingsForAthlete(athleteId: string, limit = 200): Promise<TemperatureReading[]> {
    if (!isSupabaseConfigured) return []

    const { data, error } = await supabase
      .from('thermo_readings')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('timestamp', { ascending: true })
      .limit(limit)

    if (error) {
      console.error(`Error fetching readings for athlete ${athleteId}:`, error.message)
      throw error
    }

    return ((data || []) as unknown as DbReadingRow[]).map((row) => {
      const tempVal = row.temperature !== null && row.temperature !== undefined
        ? Number(row.temperature)
        : (row.temperature_c !== null && row.temperature_c !== undefined ? Number(row.temperature_c) : null)

      return {
        athleteId: row.athlete_id,
        sensorId: row.sensor_id,
        temperature: tempVal,
        timestamp: row.timestamp || row.recorded_at || row.created_at || null,
      }
    })
  },
}
