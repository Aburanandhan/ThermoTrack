import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { MonitoringAlert } from '../types/monitoring'

interface DbAlertRow {
  id: string
  kind?: string | null
  alert_type?: string | null
  athlete_id: string | null
  device_id: string | null
  message: string
  timestamp?: string | null
  created_at?: string | null
  acknowledged?: boolean
  acknowledged_at?: string | null
  team_id?: string | null
  temperature_c?: number | null
}

export const alertService = {
  async getAlerts(limit = 50): Promise<MonitoringAlert[]> {
    if (!isSupabaseConfigured) return []

    const { data, error } = await supabase
      .from('thermo_alerts')
      .select('*')
      .eq('acknowledged', false)
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching alerts:', error.message)
      throw error
    }

    return ((data || []) as unknown as DbAlertRow[]).map((row) => ({
      id: row.id,
      kind: (row.kind || row.alert_type || 'temperature_threshold') as MonitoringAlert['kind'],
      athleteId: row.athlete_id,
      deviceId: row.device_id,
      message: row.message,
      timestamp: row.timestamp || row.created_at || new Date().toISOString(),
    }))
  },

  async acknowledgeAlert(alertId: string): Promise<void> {
    if (!isSupabaseConfigured) return

    const { error } = await supabase
      .from('thermo_alerts')
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', alertId)

    if (error) {
      console.error('Error acknowledging alert:', error.message)
      throw error
    }
  },
}
