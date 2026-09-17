import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { TrainingSession } from '../types/monitoring'

interface DbSessionRow {
  id: string
  name: string
  date: string | null
  start_time: string | null
  athlete_ids: string[] | null
  sensor_assignments: Record<string, string> | null
  monitoring_settings: Record<string, unknown> | null
  status: 'draft' | 'scheduled' | 'active' | 'completed'
  created_at: string
}

export const sessionService = {
  async getSessions(): Promise<TrainingSession[]> {
    if (!isSupabaseConfigured) return []

    const { data, error } = await supabase
      .from('thermo_sessions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching sessions:', error.message)
      throw error
    }

    return ((data || []) as unknown as DbSessionRow[]).map((row) => ({
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
    }))
  },

  async createSession(session: TrainingSession, userId?: string): Promise<TrainingSession> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.')
    }

    const { data: authData } = await supabase.auth.getUser()
    const currentUserId = userId || authData.user?.id

    const { error } = await supabase.from('thermo_sessions').insert({
      id: session.id,
      name: session.name,
      date: session.date,
      start_time: session.startTime,
      athlete_ids: session.athleteIds,
      sensor_assignments: session.sensorAssignments,
      monitoring_settings: session.monitoringSettings,
      status: session.status,
      user_id: currentUserId || undefined,
      created_at: session.createdAt,
    })

    if (error) {
      console.error('Error creating session:', error.message)
      throw error
    }

    return session
  },
}
