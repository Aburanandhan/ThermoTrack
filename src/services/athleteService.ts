import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { Athlete } from '../types/monitoring'

interface DbAthleteRow {
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

export interface AthleteInput {
  id?: string
  teamId?: string | null
  userId?: string
  name: string
  athleteCode: string
  sport?: string | null
  category?: string | null
  age?: number | null
  positionEvent?: string | null
  experienceLevel?: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  sensorId?: string | null
  deviceId?: string | null
}

export const athleteService = {
  async getAthletes(): Promise<Athlete[]> {
    if (!isSupabaseConfigured) return []
    const { data, error } = await supabase
      .from('thermo_athletes')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching athletes:', error.message)
      throw error
    }

    return ((data || []) as unknown as DbAthleteRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      athleteId: row.athlete_code,
      sensorId: row.sensor_id || null,
      deviceId: row.device_id,
      teamId: row.team_id || null,
      sport: row.sport || null,
      category: row.category || null,
      age: row.age ?? null,
      positionEvent: row.position_event || null,
      experienceLevel: row.experience_level || null,
      emergencyContactName: row.emergency_contact_name || null,
      emergencyContactPhone: row.emergency_contact_phone || null,
      createdAt: row.created_at,
    }))
  },

  async addAthlete(athlete: AthleteInput): Promise<Athlete> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.')
    }

    let currentUserId = athlete.userId
    if (!currentUserId) {
      const { data: sessionData } = await supabase.auth.getSession()
      currentUserId = sessionData?.session?.user?.id
    }
    if (!currentUserId) {
      const { data: authData } = await supabase.auth.getUser()
      currentUserId = authData?.user?.id
    }
    const athleteId = athlete.id || `ath_${Date.now()}`

    const { error } = await supabase.from('thermo_athletes').insert({
      id: athleteId,
      name: athlete.name.trim(),
      athlete_code: athlete.athleteCode.trim().toUpperCase(),
      sensor_id: athlete.sensorId?.trim() ? athlete.sensorId.trim().toUpperCase() : null,
      device_id: athlete.deviceId || null,
      team_id: athlete.teamId || null,
      sport: athlete.sport || null,
      category: athlete.category || null,
      age: athlete.age ?? null,
      position_event: athlete.positionEvent || null,
      experience_level: athlete.experienceLevel || null,
      emergency_contact_name: athlete.emergencyContactName || null,
      emergency_contact_phone: athlete.emergencyContactPhone || null,
      user_id: currentUserId || undefined,
      status: 'active',
    })

    if (error) {
      console.error('Error adding athlete:', error.message)
      throw error
    }

    return {
      id: athleteId,
      name: athlete.name,
      athleteId: athlete.athleteCode,
      sensorId: athlete.sensorId || null,
      deviceId: athlete.deviceId || null,
      teamId: athlete.teamId || null,
      sport: athlete.sport || null,
      category: athlete.category || null,
      age: athlete.age ?? null,
      positionEvent: athlete.positionEvent || null,
      experienceLevel: athlete.experienceLevel || null,
      emergencyContactName: athlete.emergencyContactName || null,
      emergencyContactPhone: athlete.emergencyContactPhone || null,
    }
  },

  async addAthletesBatch(athletes: AthleteInput[]): Promise<Athlete[]> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.')
    }
    if (athletes.length === 0) return []

    let userId = (await supabase.auth.getSession()).data?.session?.user?.id
    if (!userId) {
      const { data: authData } = await supabase.auth.getUser()
      userId = authData?.user?.id
    }

    const rows = athletes.map((a, index) => {
      const id = a.id || `ath_${Date.now()}_${index + 1}`
      return {
        id,
        name: a.name.trim(),
        athlete_code: a.athleteCode.trim().toUpperCase(),
        sensor_id: a.sensorId?.trim() ? a.sensorId.trim().toUpperCase() : null,
        device_id: a.deviceId || null,
        team_id: a.teamId || null,
        sport: a.sport || null,
        category: a.category || null,
        age: a.age ?? null,
        position_event: a.positionEvent || null,
        experience_level: a.experienceLevel || null,
        emergency_contact_name: a.emergencyContactName || null,
        emergency_contact_phone: a.emergencyContactPhone || null,
        user_id: a.userId || userId || undefined,
        status: 'active',
      }
    })

    const { data, error } = await supabase
      .from('thermo_athletes')
      .insert(rows)
      .select()

    if (error) {
      console.error('Error batch inserting athletes:', error.message)
      throw new Error(`Failed to create athletes: ${error.message}`)
    }

    return ((data || []) as unknown as DbAthleteRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      athleteId: row.athlete_code,
      sensorId: row.sensor_id || null,
      deviceId: row.device_id,
      teamId: row.team_id || null,
      sport: row.sport || null,
      category: row.category || null,
      age: row.age ?? null,
      positionEvent: row.position_event || null,
      experienceLevel: row.experience_level || null,
      emergencyContactName: row.emergency_contact_name || null,
      emergencyContactPhone: row.emergency_contact_phone || null,
      createdAt: row.created_at,
    }))
  },

  async deleteAthlete(athleteId: string): Promise<void> {
    if (!isSupabaseConfigured) return
    const { error } = await supabase
      .from('thermo_athletes')
      .delete()
      .eq('id', athleteId)

    if (error) {
      console.error('Error deleting athlete:', error.message)
      throw error
    }
  },
}
