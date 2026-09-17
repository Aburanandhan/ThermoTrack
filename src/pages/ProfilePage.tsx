import { CheckCircle2, ShieldCheck, User } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { TopHeader } from '../components/layout/TopHeader'
import { useAppShell } from '../components/layout/useAppShell'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export function ProfilePage() {
  const { openNav } = useAppShell()
  const { profile, updateProfile } = useAuth()
  const [name, setName] = useState(profile.name)
  const [email, setEmail] = useState(profile.email)
  const [organization, setOrganization] = useState(profile.organization)
  const [role, setRole] = useState(profile.role)
  const [saved, setSaved] = useState(false)
  const [passwordResetSent, setPasswordResetSent] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [isResetting, setIsResetting] = useState(false)

  const onSave = async (event: FormEvent) => {
    event.preventDefault()
    await updateProfile({ name, email, organization, role })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handlePasswordReset = async () => {
    if (!profile.email) {
      setResetError('No email associated with current session.')
      return
    }
    setIsResetting(true)
    setResetError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/profile`,
    })
    setIsResetting(false)
    if (error) {
      setResetError(error.message)
    } else {
      setPasswordResetSent(true)
    }
  }

  return (
    <>
      <TopHeader
        title="Profile & Settings"
        subtitle="Coach profile, team organization, and monitoring preferences"
        onMenu={openNav}
      />
      <main className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
        <form onSubmit={onSave} className="space-y-6">
          <Section title="Coach Information">
            <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="h-10 w-10 rounded-full bg-navy flex items-center justify-center text-white font-semibold">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-navy">{profile.name || 'Head Coach'}</p>
                <p className="text-xs text-slate-500">{profile.email || 'coach@thermotrack.io'}</p>
              </div>
            </div>

            <Field label="Full Name" value={name} onChange={setName} />
            <Field label="Email Address" type="email" value={email} onChange={setEmail} />
            <Field
              label="Organization / Athletic Program"
              value={organization}
              onChange={setOrganization}
            />
            <Field label="Coaching Role" value={role} onChange={setRole} />
          </Section>

          <Section title="Monitoring Preferences">
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-slate-300 text-teal focus:ring-teal"
              />
              Prioritize caution status athletes at the top of rosters
            </label>
            <label className="mt-2.5 flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-slate-300 text-teal focus:ring-teal"
              />
              Show live ESP32 gateway health in top navigation bar
            </label>
            <label className="mt-2.5 flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-slate-300 text-teal focus:ring-teal"
              />
              Audible ping alert on rapid core temperature rise (&gt;0.5°C in 5m)
            </label>
          </Section>

          <Section title="Security & Authentication">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Authentication and sessions are verified via Supabase Auth.</span>
            </div>

            <button
              type="button"
              disabled={isResetting}
              onClick={handlePasswordReset}
              className="mt-4 h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-navy transition hover:bg-slate-50 disabled:opacity-50"
            >
              {isResetting ? 'Sending…' : 'Send Password Reset Email'}
            </button>

            {passwordResetSent ? (
              <p className="mt-2 text-xs text-emerald-700 font-medium">
                Password reset link has been dispatched to {profile.email}.
              </p>
            ) : null}

            {resetError ? (
              <p className="mt-2 text-xs text-red-600">{resetError}</p>
            ) : null}
          </Section>

          {saved ? (
            <div className="flex items-center gap-2 rounded-lg border border-teal/30 bg-teal/5 p-3 text-xs font-medium text-teal-dark">
              <CheckCircle2 className="h-4 w-4 text-teal" />
              Profile updates saved successfully.
            </div>
          ) : null}

          <button
            type="submit"
            className="h-10 rounded-lg bg-teal px-6 text-xs font-semibold text-white shadow-xs transition hover:bg-teal-dark"
          >
            Save Changes
          </button>
        </form>
      </main>
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-navy">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <label className="mb-3 block last:mb-0">
      <span className="text-xs font-semibold text-navy">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-teal"
      />
    </label>
  )
}
