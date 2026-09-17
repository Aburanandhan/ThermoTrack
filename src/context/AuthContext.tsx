import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { teamService } from '../services/teamService'
import type { TeamProfile, UserProfile } from '../types/monitoring'

interface AuthContextValue {
  isAuthenticated: boolean
  userId: string | null
  profile: UserProfile
  team: TeamProfile | null
  hasCompletedOnboarding: boolean
  loading: boolean
  signIn: (email: string, password: string, remember: boolean) => Promise<{ error: string | null; hasCompletedOnboarding?: boolean }>
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>
  refreshTeam: () => Promise<void>
}

const emptyProfile: UserProfile = {
  name: '',
  email: '',
  organization: '',
  role: 'Coach',
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionUser, setSessionUser] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile>(emptyProfile)
  const [team, setTeam] = useState<TeamProfile | null>(null)
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(false)
  const [loading, setLoading] = useState(true)

  const loadTeam = useCallback(async (userId: string) => {
    try {
      const teamProfile = await teamService.getTeam(userId)
      if (teamProfile) {
        setTeam(teamProfile)
        setHasCompletedOnboarding(teamProfile.onboardingCompleted)
      } else {
        setTeam(null)
        setHasCompletedOnboarding(false)
      }
    } catch (err) {
      console.error('Error loading team in AuthProvider:', err)
    }
  }, [])

  const refreshTeam = useCallback(async () => {
    if (sessionUser) {
      await loadTeam(sessionUser)
    }
  }, [loadTeam, sessionUser])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    // Resolve the restored session and its onboarding state before rendering route decisions.
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setSessionUser(session.user.id)
          const userMeta = session.user.user_metadata || {}
          setProfile({
            name: (userMeta.name as string) || (userMeta.full_name as string) || 'Coach',
            email: session.user.email || '',
            organization: (userMeta.organization as string) || (userMeta.team_name as string) || '',
            role: (userMeta.role as string) || 'Coach',
          })
          await loadTeam(session.user.id)
        }
      } catch (err) {
        console.error('Error restoring Supabase session:', err)
      } finally {
        setLoading(false)
      }
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setSessionUser(session.user.id)
        const userMeta = session.user.user_metadata || {}
        setProfile({
          name: (userMeta.name as string) || (userMeta.full_name as string) || 'Coach',
          email: session.user.email || '',
          organization: (userMeta.organization as string) || (userMeta.team_name as string) || '',
          role: (userMeta.role as string) || 'Coach',
        })
        await loadTeam(session.user.id)
      } else {
        setSessionUser(null)
        setProfile(emptyProfile)
        setTeam(null)
        setHasCompletedOnboarding(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [loadTeam])

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: string | null; hasCompletedOnboarding?: boolean }> => {
      if (!isSupabaseConfigured) {
        return { error: 'Supabase authentication service is not configured.' }
      }

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          return { error: error.message }
        }

        if (data.user) {
          setSessionUser(data.user.id)
          const meta = data.user.user_metadata || {}
          setProfile({
            name: (meta.name as string) || 'Coach',
            email: data.user.email || email,
            organization: (meta.organization as string) || (meta.team_name as string) || '',
            role: (meta.role as string) || 'Coach',
          })
          const teamProfile = await teamService.getTeam(data.user.id)
          const completed = Boolean(teamProfile?.onboardingCompleted)
          setTeam(teamProfile)
          setHasCompletedOnboarding(completed)
          return { error: null, hasCompletedOnboarding: completed }
        }

        return { error: null, hasCompletedOnboarding: false }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Sign in failed'
        return { error: msg }
      }
    },
    [],
  )

  const signUp = useCallback(
    async (email: string, password: string, name: string): Promise<{ error: string | null }> => {
      if (!isSupabaseConfigured) {
        return { error: 'Supabase authentication service is not configured.' }
      }

      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name, organization: '', role: 'Coach' },
          },
        })

        if (error) return { error: error.message }

        if (data.user) {
          setSessionUser(data.user.id)
        }

        return { error: null }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Sign up failed'
        return { error: msg }
      }
    },
    [],
  )

  const resetPassword = useCallback(async (email: string): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) {
      return { error: 'Supabase authentication service is not configured.' }
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/profile`,
      })
      if (error) return { error: error.message }
      return { error: null }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password reset request failed'
      return { error: msg }
    }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {})
    setSessionUser(null)
    setProfile(emptyProfile)
  }, [])

  const updateProfile = useCallback(async (patch: Partial<UserProfile>) => {
    setProfile((current) => ({ ...current, ...patch }))

    try {
      await supabase.auth.updateUser({
        data: {
          name: patch.name,
          organization: patch.organization,
          role: patch.role,
        },
      })
    } catch (err) {
      console.error('Failed to update user profile in auth service:', err)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(sessionUser),
      userId: sessionUser,
      profile,
      team,
      hasCompletedOnboarding,
      loading,
      signIn,
      signUp,
      resetPassword,
      signOut,
      updateProfile,
      refreshTeam,
    }),
    [
      sessionUser,
      profile,
      team,
      hasCompletedOnboarding,
      loading,
      signIn,
      signUp,
      resetPassword,
      signOut,
      updateProfile,
      refreshTeam,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
