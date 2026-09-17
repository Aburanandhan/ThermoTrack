import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { athleteService } from './athleteService'
import type { Athlete, TeamProfile } from '../types/monitoring'

interface DbTeamRow {
  id: string
  user_id: string
  name: string
  coach_name: string
  country_region: string | null
  description: string | null
  sport: string
  default_category: string | null
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export const teamService = {
  async getTeam(userId?: string): Promise<TeamProfile | null> {
    if (!isSupabaseConfigured) return null

    const currentUserId = userId || (await supabase.auth.getUser()).data.user?.id
    if (!currentUserId) return null

    const { data, error } = await supabase
      .from('thermo_teams')
      .select('*')
      .eq('user_id', currentUserId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching team profile:', error.message)
      return null
    }

    if (!data) return null
    const row = data as unknown as DbTeamRow

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      coachName: row.coach_name,
      countryRegion: row.country_region,
      description: row.description,
      sport: row.sport,
      defaultCategory: row.default_category,
      onboardingCompleted: Boolean(row.onboarding_completed),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  },

  async hasCompletedOnboarding(userId?: string): Promise<boolean> {
    const team = await this.getTeam(userId)
    return Boolean(team?.onboardingCompleted)
  },

  async createTeamWithAthletes(payload: {
    team: {
      name: string
      coachName: string
      countryRegion?: string | null
      description?: string | null
      sport: string
      defaultCategory?: string | null
    }
    athletes: Array<{
      name: string
      athleteId: string
      sport?: string | null
      category?: string | null
      age?: number | null
      positionEvent?: string | null
      experienceLevel?: string | null
      emergencyContactName?: string | null
      emergencyContactPhone?: string | null
      sensorId?: string | null
      deviceId?: string | null
    }>
  }): Promise<{ team: TeamProfile; athletes: Athlete[] }> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.')
    }

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      throw new Error('Authenticated coach session required to create a team.')
    }

    const userId = authData.user.id
    const teamId = `team_${userId.substring(0, 8)}_${Date.now()}`

    // 1. Insert or update team
    const { data: teamData, error: teamInsertError } = await supabase
      .from('thermo_teams')
      .upsert({
        id: teamId,
        user_id: userId,
        name: payload.team.name.trim(),
        coach_name: payload.team.coachName.trim(),
        country_region: payload.team.countryRegion?.trim() || null,
        description: payload.team.description?.trim() || null,
        sport: payload.team.sport.trim(),
        default_category: payload.team.defaultCategory?.trim() || null,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (teamInsertError) {
      console.error('Failed to create team:', teamInsertError.message)
      throw new Error(`Failed to create team: ${teamInsertError.message}`)
    }

    const createdTeamRow = teamData as unknown as DbTeamRow
    const createdTeam: TeamProfile = {
      id: createdTeamRow.id,
      userId: createdTeamRow.user_id,
      name: createdTeamRow.name,
      coachName: createdTeamRow.coach_name,
      countryRegion: createdTeamRow.country_region,
      description: createdTeamRow.description,
      sport: createdTeamRow.sport,
      defaultCategory: createdTeamRow.default_category,
      onboardingCompleted: true,
      createdAt: createdTeamRow.created_at,
      updatedAt: createdTeamRow.updated_at,
    }

    // 2. Insert athletes in batch
    let createdAthletes: Athlete[] = []
    if (payload.athletes.length > 0) {
      const athleteRecords = payload.athletes.map((ath, index) => ({
        id: `ath_${Date.now()}_${index + 1}`,
        teamId: createdTeam.id,
        userId: userId,
        name: ath.name.trim(),
        athleteCode: ath.athleteId.trim().toUpperCase(),
        sport: ath.sport || payload.team.sport,
        category: ath.category || payload.team.defaultCategory || null,
        age: ath.age ?? null,
        positionEvent: ath.positionEvent?.trim() || null,
        experienceLevel: ath.experienceLevel?.trim() || null,
        emergencyContactName: ath.emergencyContactName?.trim() || null,
        emergencyContactPhone: ath.emergencyContactPhone?.trim() || null,
        sensorId: ath.sensorId?.trim() ? ath.sensorId.trim().toUpperCase() : null,
        deviceId: ath.deviceId?.trim() || null,
      }))

      createdAthletes = await athleteService.addAthletesBatch(athleteRecords)
    }

    // Update user auth metadata for fast local access
    await supabase.auth
      .updateUser({
        data: {
          team_id: createdTeam.id,
          team_name: createdTeam.name,
          onboarding_completed: true,
        },
      })
      .catch((err) => {
        console.warn('Could not update user metadata with team info:', err)
      })

    return {
      team: createdTeam,
      athletes: createdAthletes,
    }
  },
}
