import { Ear, Radio, ShieldCheck, Thermometer } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function SignInPage() {
  const { isAuthenticated, hasCompletedOnboarding, loading, signIn, signUp, resetPassword } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (loading) {
    return null
  }

  if (isAuthenticated) {
    return <Navigate to={hasCompletedOnboarding ? '/' : '/onboarding'} replace />
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!email) {
      setError('Please enter your email address.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setSuccessMsg(null)

    if (mode === 'forgot') {
      const res = await resetPassword(email)
      setIsSubmitting(false)
      if (res.error) {
        setError(res.error)
      } else {
        setSuccessMsg('A password reset link has been sent to your email address.')
      }
      return
    }

    if (!password) {
      setError('Please enter your password.')
      setIsSubmitting(false)
      return
    }

    if (mode === 'signin') {
      const res = await signIn(email, password, remember)
      setIsSubmitting(false)
      if (res.error) {
        setError(res.error)
      } else {
        navigate(res.hasCompletedOnboarding ? '/' : '/onboarding', { replace: true })
      }
    } else {
      if (!name.trim()) {
        setError('Please enter your full name.')
        setIsSubmitting(false)
        return
      }
      const res = await signUp(email, password, name.trim())
      setIsSubmitting(false)
      if (res.error) {
        setError(res.error)
      } else {
        setSuccessMsg(
          'Account created successfully! Please verify your email or sign in.',
        )
        setMode('signin')
      }
    }
  }

  return (
    <div className="grid min-h-svh bg-canvas lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative overflow-hidden bg-navy px-8 py-10 text-white lg:px-14 lg:py-16">
        <div className="relative z-10 max-w-md">
          <p className="text-sm font-bold tracking-[0.28em] text-teal">THERMOTRACK</p>
          <h1 className="mt-6 text-3xl font-semibold leading-tight sm:text-4xl">
            Real-time core temperature intelligence for elite athletes.
          </h1>
          <p className="mt-4 text-sm leading-6 text-white/70">
            Monitor real telemetry from wearable ear-sensors and ESP32 gateway devices during high-intensity training.
          </p>
        </div>
        <BrandVisual />
      </section>

      <section className="flex items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => {
                setMode('signin')
                setError(null)
                setSuccessMsg(null)
              }}
              className={`pb-2.5 text-sm font-semibold transition border-b-2 mr-6 ${
                mode === 'signin'
                  ? 'border-teal text-navy'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup')
                setError(null)
                setSuccessMsg(null)
              }}
              className={`pb-2.5 text-sm font-semibold transition border-b-2 mr-6 ${
                mode === 'signup'
                  ? 'border-teal text-navy'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('forgot')
                setError(null)
                setSuccessMsg(null)
              }}
              className={`pb-2.5 text-sm font-semibold transition border-b-2 ${
                mode === 'forgot'
                  ? 'border-teal text-navy'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Forgot Password
            </button>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            {mode === 'signin' && 'Sign in with your registered coach credentials to access live telemetry.'}
            {mode === 'signup' && 'Register a new coach account backed by Supabase Authentication.'}
            {mode === 'forgot' && 'Enter your email to receive password reset instructions.'}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {mode === 'signup' ? (
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-navy">Full Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Coach Alex Mercer"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none transition focus:border-teal"
                  required
                />
              </label>
            ) : null}

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-navy">Email address</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="coach@example.com"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none transition focus:border-teal"
                required
              />
            </label>

            {mode !== 'forgot' ? (
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-navy">Password</span>
                <input
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none transition focus:border-teal"
                  required
                />
              </label>
            ) : null}

            {mode === 'signin' ? (
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-teal"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-xs font-medium text-teal hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            ) : null}

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-600">
                {error}
              </p>
            ) : null}

            {successMsg ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-700">
                {successMsg}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-10 w-full rounded-lg bg-navy text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {isSubmitting
                ? 'Processing…'
                : mode === 'signin'
                  ? 'Sign In to Dashboard'
                  : mode === 'signup'
                    ? 'Register Coach Account'
                    : 'Send Reset Link'}
            </button>
          </form>

          <p className="mt-8 flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Protected by Supabase Authentication & Row-Level Security.
          </p>
        </div>
      </section>
    </div>
  )
}

function BrandVisual() {
  return (
    <div
      className="relative mt-12 h-64 lg:absolute lg:bottom-0 lg:right-0 lg:mt-0 lg:h-[70%] lg:w-[70%]"
      aria-hidden="true"
    >
      <svg viewBox="0 0 420 320" className="h-full w-full opacity-90">
        <ellipse cx="210" cy="250" rx="140" ry="28" fill="#12233a" />
        <circle cx="210" cy="118" r="28" fill="#d7e3ee" />
        <path d="M168 168c8-28 76-28 84 0v70h-84z" fill="#d7e3ee" />
        <rect x="188" y="86" width="44" height="14" rx="7" fill="#0d9488" />
        <path d="M232 93h46" stroke="#0d9488" strokeWidth="3" />
        <circle cx="286" cy="93" r="8" fill="none" stroke="#0d9488" strokeWidth="3" />
        <path d="M40 70h80M40 90h52M40 110h68" stroke="#1d3554" strokeWidth="3" />
        <rect x="36" y="48" width="120" height="80" rx="12" fill="none" stroke="#1d3554" />
        <polyline
          points="52,96 72,78 88,88 108,64"
          fill="none"
          stroke="#0d9488"
          strokeWidth="3"
        />
      </svg>
      <div className="absolute bottom-8 left-8 flex flex-wrap gap-3 text-xs text-white/70">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1">
          <Ear className="h-3.5 w-3.5" /> Wearable sensor
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1">
          <Radio className="h-3.5 w-3.5" /> Real-time monitoring
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1">
          <Thermometer className="h-3.5 w-3.5" /> Temperature
        </span>
      </div>
    </div>
  )
}
