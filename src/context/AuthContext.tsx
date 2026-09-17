import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { teamService } from '../services/teamService'
import type { TeamProfile, UserProfile } from '../types/monitoring'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'
export type OnboardingStatus = 'loading' | 'complete' | 'incomplete'

export interface AuthContextValue {
  authStatus: AuthStatus
  onboardingStatus: OnboardingStatus
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
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading')
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus>('loading')
  const [sessionUser, setSessionUser] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile>(emptyProfile)
  const [team, setTeam] = useState<TeamProfile | null>(null)

  const seqRef = useRef(0)

  const resolveAuthState = useCallback(async (session: Session | null) => {
    const currentSeq = ++seqRef.current

    if (!session?.user) {
      if (currentSeq === seqRef.current) {
        setSessionUser(null)
        setProfile(emptyProfile)
        setTeam(null)
        setOnboardingStatus('incomplete')
        setAuthStatus('unauthenticated')
      }
      return
    }

    const user = session.user
    const userMeta = (user.user_metadata || {}) as Record<string, unknown>
    const nextProfile: UserProfile = {
      name: (userMeta.name as string) || (userMeta.full_name as string) || 'Coach',
      email: user.email || '',
      organization: (userMeta.organization as string) || (userMeta.team_name as string) || '',
      role: (userMeta.role as string) || 'Coach',
    }

    let teamProfile: TeamProfile | null = null
    let isComplete = false

    try {
      teamProfile = await teamService.getTeam(user.id)
      if (teamProfile) {
        isComplete = Boolean(teamProfile.onboardingCompleted)
      } else if (userMeta.onboarding_completed === true) {
        isComplete = true
      } else {
        isComplete = false
      }
    } catch (err) {
      console.error('Error fetching team in resolveAuthState:', err)
      if (userMeta.onboarding_completed === true) {
        isComplete = true
      }
    }

    if (currentSeq === seqRef.current) {
      setSessionUser(user.id)
      setProfile(nextProfile)
      setTeam(teamProfile)
      setOnboardingStatus(isComplete ? 'complete' : 'incomplete')
      setAuthStatus('authenticated')
    }
  }, [])

  const refreshTeam = useCallback(async () => {
    if (sessionUser) {
      try {
        const teamProfile = await teamService.getTeam(sessionUser)
        if (teamProfile) {
          setTeam(teamProfile)
          const completed = Boolean(teamProfile.onboardingCompleted)
          setOnboardingStatus(completed ? 'complete' : 'incomplete')
        }
      } catch (err) {
        console.error('Error refreshing team in AuthProvider:', err)
      }
    }
  }, [sessionUser])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthStatus('unauthenticated')
      setOnboardingStatus('incomplete')
      return
    }

    // 1. Initial resolution via getSession
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        await resolveAuthState(session)
      } catch (err) {
        console.error('Error in initial getSession:', err)
        await resolveAuthState(null)
      }
    })()

    // 2. Auth listener for session events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await resolveAuthState(session)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [resolveAuthState])

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

        if (data.user && data.session) {
          await resolveAuthState(data.session)
          const teamProfile = await teamService.getTeam(data.user.id)
          const meta = (data.user.user_metadata || {}) as Record<string, unknown>
          const completed = Boolean(teamProfile?.onboardingCompleted || meta.onboarding_completed === true)
          return { error: null, hasCompletedOnboarding: completed }
        }

        return { error: null, hasCompletedOnboarding: false }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Sign in failed'
        return { error: msg }
      }
    },
    [resolveAuthState],
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

        if (data.user && data.session) {
          await resolveAuthState(data.session)
        }

        return { error: null }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Sign up failed'
        return { error: msg }
      }
    },
    [resolveAuthState],
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
    await resolveAuthState(null)
  }, [resolveAuthState])

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

  const isLoading = authStatus === 'loading' || (authStatus === 'authenticated' && onboardingStatus === 'loading')
  const isAuthenticated = authStatus === 'authenticated'
  const hasCompletedOnboarding = onboardingStatus === 'complete'

  const value = useMemo<AuthContextValue>(
    () => ({
      authStatus,
      onboardingStatus,
      isAuthenticated,
      userId: sessionUser,
      profile,
      team,
      hasCompletedOnboarding,
      loading: isLoading,
      signIn,
      signUp,
      resetPassword,
      signOut,
      updateProfile,
      refreshTeam,
    }),
    [
      authStatus,
      onboardingStatus,
      isAuthenticated,
      sessionUser,
      profile,
      team,
      hasCompletedOnboarding,
      isLoading,
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

