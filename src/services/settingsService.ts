import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { DEFAULT_TEMPERATURE_THRESHOLDS } from '../config/thresholds'
import type { TemperatureThresholds } from '../types/monitoring'

interface DbSettingsRow {
  id: string
  thresholds: TemperatureThresholds
}

export const settingsService = {
  async getThresholds(): Promise<TemperatureThresholds> {
    if (!isSupabaseConfigured) return DEFAULT_TEMPERATURE_THRESHOLDS

    const { data: authData } = await supabase.auth.getUser()
    const userId = authData.user?.id

    let query = supabase.from('thermo_settings').select('*')
    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query.order('updated_at', { ascending: false }).limit(1).maybeSingle()

    if (error) {
      console.warn('Could not fetch custom thresholds from thermo_settings; using configured defaults.')
      return DEFAULT_TEMPERATURE_THRESHOLDS
    }

    const row = data as unknown as DbSettingsRow | null
    return row?.thresholds || DEFAULT_TEMPERATURE_THRESHOLDS
  },

  async updateThresholds(thresholds: TemperatureThresholds, userId?: string): Promise<void> {
    if (!isSupabaseConfigured) return

    const { data: authData } = await supabase.auth.getUser()
    const currentUserId = userId || authData.user?.id

    const { error } = await supabase.from('thermo_settings').upsert({
      id: currentUserId ? `settings_${currentUserId}` : 'default',
      user_id: currentUserId || undefined,
      thresholds,
      updated_at: new Date().toISOString(),
    })

    if (error) {
      console.error('Error updating thresholds:', error.message)
      throw error
    }
  },
}
