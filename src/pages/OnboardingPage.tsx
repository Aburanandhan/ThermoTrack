import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Info,
  Plus,
  Radio,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { getCategoriesForSport, SPORTS_CATALOGUE } from '../config/sports'
import { useAuth } from '../context/AuthContext'
import { useMonitoring } from '../context/MonitoringContext'
import { teamService } from '../services/teamService'

type Step = 'team' | 'sport' | 'athletes' | 'review' | 'complete'

interface AthleteDraft {
  id: string
  name: string
  athleteId: string
  sport: string
  category: string
  age: string
  positionEvent: string
  experienceLevel: string
  emergencyContactName: string
  emergencyContactPhone: string
  sensorId: string
}

const STEPS: { id: Step; label: string; number: string }[] = [
  { id: 'team', label: 'Team', number: '01' },
  { id: 'sport', label: 'Sport', number: '02' },
  { id: 'athletes', label: 'Athletes', number: '03' },
  { id: 'review', label: 'Review', number: '04' },
  { id: 'complete', label: 'Complete', number: '05' },
]

export function OnboardingPage() {
  const { isAuthenticated, hasCompletedOnboarding, profile, refreshTeam } = useAuth()
  const { refresh: refreshMonitoring } = useMonitoring()
  const navigate = useNavigate()

  const [currentStep, setCurrentStep] = useState<Step>('team')

  // Step 1: Team details
  const [teamName, setTeamName] = useState('')
  const [coachName, setCoachName] = useState(() => profile.name || '')
  const [countryRegion, setCountryRegion] = useState('')
  const [description, setDescription] = useState('')

  // Step 2: Sport profile
  const [selectedSport, setSelectedSport] = useState<string>('Track & Field')
  const [customSport, setCustomSport] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('Sprint')
  const [customCategory, setCustomCategory] = useState<string>('')

  const effectiveSport = selectedSport === 'Other' ? (customSport.trim() || 'Other') : selectedSport
  const effectiveCategory =
    selectedCategory === 'Other' ? (customCategory.trim() || 'General Squad') : selectedCategory

  const createDefaultAthleteDraft = (index: number, sport: string, category: string): AthleteDraft => {
    const numStr = String(index + 1).padStart(3, '0')
    return {
      id: `ath_draft_${Date.now()}_${index + 1}`,
      name: '',
      athleteId: `ATH-${numStr}`,
      sport,
      category,
      age: '',
      positionEvent: '',
      experienceLevel: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      sensorId: '',
    }
  }

  // Step 3: Athletes roster
  const [athleteCount, setAthleteCount] = useState<number>(3)
  const [athleteDrafts, setAthleteDrafts] = useState<AthleteDraft[]>(() => [
    createDefaultAthleteDraft(0, 'Track & Field', 'Sprint'),
    createDefaultAthleteDraft(1, 'Track & Field', 'Sprint'),
    createDefaultAthleteDraft(2, 'Track & Field', 'Sprint'),
  ])

  // Submission & Error State
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [createdCount, setCreatedCount] = useState(0)

  // If user already completed onboarding, redirect to overview
  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />
  }

  if (hasCompletedOnboarding && currentStep !== 'complete') {
    return <Navigate to="/" replace />
  }

  // Handle sport change: sync defaults and all athlete drafts
  const handleSportChange = (sportName: string) => {
    setSelectedSport(sportName)
    const cats = getCategoriesForSport(sportName)
    const defaultCat = cats[0] || 'General Squad'
    setSelectedCategory(defaultCat)
    const targetSport = sportName === 'Other' ? customSport.trim() || 'Other' : sportName

    // Reset and align all dependent athlete values to the newly selected sport
    setAthleteDrafts((current) =>
      current.map((ath) => ({
        ...ath,
        sport: targetSport,
        category: defaultCat,
      })),
    )
  }

  const handleCustomSportChange = (sportName: string) => {
    setCustomSport(sportName)
    if (selectedSport === 'Other') {
      const targetSport = sportName.trim() || 'Other'
      setAthleteDrafts((current) =>
        current.map((ath) => ({
          ...ath,
          sport: targetSport,
        })),
      )
    }
  }

  const handleCategoryChange = (categoryName: string) => {
    setSelectedCategory(categoryName)
    const targetCategory = categoryName === 'Other' ? customCategory.trim() || 'General Squad' : categoryName
    setAthleteDrafts((current) =>
      current.map((ath) => ({
        ...ath,
        category: targetCategory,
      })),
    )
  }

  const handleCustomCategoryChange = (categoryName: string) => {
    setCustomCategory(categoryName)
    if (selectedCategory === 'Other') {
      const targetCategory = categoryName.trim() || 'General Squad'
      setAthleteDrafts((current) =>
        current.map((ath) => ({
          ...ath,
          category: targetCategory,
        })),
      )
    }
  }

  // Handle athlete count change
  const handleAthleteCountChange = (newCount: number) => {
    const validCount = Math.max(1, Math.min(50, newCount))
    setAthleteCount(validCount)

    setAthleteDrafts((current) => {
      if (validCount > current.length) {
        const additions: AthleteDraft[] = []
        for (let i = current.length; i < validCount; i++) {
          additions.push(createDefaultAthleteDraft(i, effectiveSport, effectiveCategory))
        }
        return [...current, ...additions]
      } else if (validCount < current.length) {
        return current.slice(0, validCount)
      }
      return current
    })
  }

  const handleAddAthlete = () => {
    const nextNum = athleteDrafts.length
    const newDraft = createDefaultAthleteDraft(nextNum, effectiveSport, effectiveCategory)
    setAthleteDrafts((curr) => [...curr, newDraft])
    setAthleteCount((c) => c + 1)
  }

  const handleRemoveAthlete = (index: number) => {
    if (athleteDrafts.length <= 1) return
    setAthleteDrafts((curr) => curr.filter((_, i) => i !== index))
    setAthleteCount((c) => c - 1)
  }

  const handleUpdateAthlete = (index: number, patch: Partial<AthleteDraft>) => {
    setAthleteDrafts((curr) => {
      const copy = [...curr]
      copy[index] = {
        ...copy[index],
        ...patch,
        sport: effectiveSport,
      }
      return copy
    })
  }

  // Step 1 Validation -> Step 2
  const validateStep1 = (e: FormEvent) => {
    e.preventDefault()
    if (!teamName.trim()) {
      setFormError('Please enter a team or organization name.')
      return
    }
    if (!coachName.trim()) {
      setFormError('Please enter the coach or director name.')
      return
    }
    setFormError(null)
    setCurrentStep('sport')
  }

  // Step 2 Validation -> Step 3
  const validateStep2 = (e: FormEvent) => {
    e.preventDefault()
    if (selectedSport === 'Other' && !customSport.trim()) {
      setFormError('Please enter your custom sport name.')
      return
    }
    if (selectedCategory === 'Other' && !customCategory.trim()) {
      setFormError('Please enter your custom sport discipline or category.')
      return
    }
    setFormError(null)

    const validCategories = getCategoriesForSport(effectiveSport)

    // Reconcile and guarantee every draft has the current effective sport and a valid category
    setAthleteDrafts((curr) =>
      curr.map((a) => {
        const isValidCat =
          validCategories.includes(a.category) || (selectedCategory === 'Other' && a.category === effectiveCategory)
        return {
          ...a,
          sport: effectiveSport,
          category: isValidCat ? a.category : effectiveCategory,
        }
      }),
    )
    setCurrentStep('athletes')
  }

  // Step 3 Validation -> Step 4 (Review)
  const validateStep3 = (e: FormEvent) => {
    e.preventDefault()
    // 1. Check required names & IDs
    for (let i = 0; i < athleteDrafts.length; i++) {
      const draft = athleteDrafts[i]
      if (!draft.name.trim()) {
        setFormError(`Athlete #${i + 1} is missing a full name.`)
        return
      }
      if (!draft.athleteId.trim()) {
        setFormError(`Athlete #${i + 1} is missing an Athlete ID.`)
        return
      }
    }

    // 2. Duplicate Athlete ID Check
    const seenIds = new Set<string>()
    for (let i = 0; i < athleteDrafts.length; i++) {
      const idUpper = athleteDrafts[i].athleteId.trim().toUpperCase()
      if (seenIds.has(idUpper)) {
        setFormError(`Duplicate Athlete ID: "${idUpper}" is used more than once. Each athlete must have a unique ID.`)
        return
      }
      seenIds.add(idUpper)
    }

    setFormError(null)
    setCurrentStep('review')
  }

  // Final Step: Persist Team and Athletes to Supabase
  const handleFinalSubmit = async () => {
    setIsSubmitting(true)
    setFormError(null)

    try {
      const result = await teamService.createTeamWithAthletes({
        team: {
          name: teamName.trim(),
          coachName: coachName.trim(),
          countryRegion: countryRegion.trim() || null,
          description: description.trim() || null,
          sport: effectiveSport,
          defaultCategory: effectiveCategory,
        },
        athletes: athleteDrafts.map((draft) => ({
          name: draft.name.trim(),
          athleteId: draft.athleteId.trim().toUpperCase(),
          sport: effectiveSport,
          category: draft.category.trim() || effectiveCategory,
          age: draft.age ? parseInt(draft.age, 10) : null,
          positionEvent: draft.positionEvent.trim() || null,
          experienceLevel: draft.experienceLevel.trim() || null,
          emergencyContactName: draft.emergencyContactName.trim() || null,
          emergencyContactPhone: draft.emergencyContactPhone.trim() || null,
          sensorId: draft.sensorId.trim() ? draft.sensorId.trim().toUpperCase() : null,
          deviceId: null,
        })),
      })

      setCreatedCount(result.athletes.length)
      await refreshTeam()
      await refreshMonitoring()
      setCurrentStep('complete')
    } catch (err: unknown) {
      console.error('Onboarding submission error:', err)
      const msg = err instanceof Error ? err.message : 'Your information could not be saved. Please try again.'
      setFormError(`Unable to complete setup. ${msg}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFinishOnboarding = () => {
    navigate('/', { replace: true })
  }

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep)

  return (
    <div className="min-h-screen bg-canvas text-navy">
      {/* Header */}
      <header className="border-b border-slate-200 bg-navy text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal text-white shadow-xs">
              <Activity className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-bold tracking-[0.25em] text-teal">THERMOTRACK</p>
              <p className="text-[11px] text-slate-300">Team & Athlete Onboarding</p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-300">
            <span>Signed in as </span>
            <span className="font-semibold text-white">{profile.email || 'Coach'}</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
        {/* Progress Stepper */}
        {currentStep !== 'complete' && (
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {STEPS.slice(0, 4).map((step, idx) => {
                const isPassed = idx < currentStepIndex
                const isCurrent = step.id === currentStep

                return (
                  <div key={step.id} className="flex flex-1 items-center">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                          isPassed
                            ? 'bg-teal text-white'
                            : isCurrent
                              ? 'bg-navy text-white ring-4 ring-teal/20'
                              : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {isPassed ? <Check className="h-3.5 w-3.5" /> : step.number}
                      </div>
                      <span
                        className={`hidden text-xs font-semibold uppercase tracking-wider sm:inline ${
                          isCurrent ? 'text-navy' : isPassed ? 'text-teal' : 'text-slate-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {idx < 3 && (
                      <div
                        className={`mx-2 h-0.5 flex-1 transition sm:mx-4 ${
                          idx < currentStepIndex ? 'bg-teal' : 'bg-slate-200'
                        }`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Error Banner */}
        {formError && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 shadow-xs">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <div>
              <p className="font-semibold">{formError}</p>
            </div>
          </div>
        )}

        {/* STEP 01: TEAM DETAILS */}
        {currentStep === 'team' && (
          <form onSubmit={validateStep1} className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
              <div className="border-b border-slate-100 pb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-teal">Step 01 of 04</span>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-navy">
                  Let's set up your monitoring team.
                </h1>
                <p className="mt-1 text-xs text-slate-500">
                  Add your athletes and define their training profile so ThermoTrack can organize monitoring around your team.
                </p>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-navy">
                    Team / Organization Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="e.g. Velocity Performance Team"
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3.5 text-xs outline-none focus:border-teal"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    The official name of your squad, club, varsity team, or performance training center.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-navy">
                      Head Coach / Director Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={coachName}
                      onChange={(e) => setCoachName(e.target.value)}
                      placeholder="e.g. Coach Arun"
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3.5 text-xs outline-none focus:border-teal"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-navy">
                      Country / Region
                    </label>
                    <input
                      type="text"
                      value={countryRegion}
                      onChange={(e) => setCountryRegion(e.target.value)}
                      placeholder="e.g. India"
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3.5 text-xs outline-none focus:border-teal"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy">
                    Team Description <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Elite national sprinting & middle distance track conditioning squad."
                    className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 text-xs outline-none focus:border-teal"
                  />
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <Shield className="h-3.5 w-3.5 text-teal" />
                  <span>Row-Level Security protects your team data.</span>
                </div>
                <button
                  type="submit"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy px-6 text-xs font-semibold text-white transition hover:bg-slate-800"
                >
                  Next: Sport Profile
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </form>
        )}

        {/* STEP 02: SPORT PROFILE */}
        {currentStep === 'sport' && (
          <form onSubmit={validateStep2} className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
              <div className="border-b border-slate-100 pb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-teal">Step 02 of 04</span>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-navy">
                  What sport does your team participate in?
                </h1>
                <p className="mt-1 text-xs text-slate-500">
                  Select your primary sport. Athlete monitoring and discipline categories will be automatically tailored to your sport.
                </p>
              </div>

              {/* Sports Grid */}
              <div className="mt-6">
                <label className="block text-xs font-semibold text-navy mb-3">
                  Select Primary Sport <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                  {SPORTS_CATALOGUE.map((sport) => {
                    const isSelected = selectedSport === sport.name
                    return (
                      <button
                        key={sport.id}
                        type="button"
                        onClick={() => handleSportChange(sport.name)}
                        className={`flex items-center justify-between rounded-xl border p-3 text-left transition ${
                          isSelected
                            ? 'border-teal bg-teal/5 text-navy font-semibold ring-2 ring-teal/30'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <span className="text-xs">{sport.name}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-teal shrink-0" />}
                      </button>
                    )
                  })}
                </div>

                {selectedSport === 'Other' && (
                  <div className="mt-4">
                    <label className="block text-xs font-semibold text-navy">
                      Specify Custom Sport <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={customSport}
                      onChange={(e) => handleCustomSportChange(e.target.value)}
                      placeholder="e.g. Rowing / Kayaking"
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3.5 text-xs outline-none focus:border-teal"
                    />
                  </div>
                )}
              </div>

              {/* Dynamic Categories */}
              <div className="mt-6 border-t border-slate-100 pt-6">
                <label className="block text-xs font-semibold text-navy mb-2">
                  Sport Category / Discipline for {effectiveSport}
                </label>
                <p className="text-[11px] text-slate-400 mb-3">
                  This default discipline will be assigned to your athletes. You can customize individual athletes in the next step.
                </p>
                <div className="flex flex-wrap gap-2">
                  {getCategoriesForSport(selectedSport).map((cat) => {
                    const isSelected = selectedCategory === cat
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleCategoryChange(cat)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                          isSelected
                            ? 'border-navy bg-navy text-white shadow-xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {cat}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => handleCategoryChange('Other')}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      selectedCategory === 'Other'
                        ? 'border-navy bg-navy text-white shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    Custom Category…
                  </button>
                </div>

                {selectedCategory === 'Other' && (
                  <div className="mt-3">
                    <input
                      type="text"
                      required
                      value={customCategory}
                      onChange={(e) => handleCustomCategoryChange(e.target.value)}
                      placeholder="e.g. Lightweight Division / Adaptive"
                      className="h-9 w-full max-w-sm rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-teal"
                    />
                  </div>
                )}
              </div>

              <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null)
                    setCurrentStep('team')
                  }}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 px-4 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <button
                  type="submit"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy px-6 text-xs font-semibold text-white transition hover:bg-slate-800"
                >
                  Next: Athlete Roster
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </form>
        )}

        {/* STEP 03: ATHLETE DETAILS */}
        {currentStep === 'athletes' && (
          <form onSubmit={validateStep3} className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
              <div className="border-b border-slate-100 pb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-teal">Step 03 of 04</span>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-navy">
                  How many athletes are you monitoring?
                </h1>
                <p className="mt-1 text-xs text-slate-500">
                  Enter your athlete roster. Sport ({effectiveSport}) and discipline ({effectiveCategory}) are pre-populated from your team profile.
                </p>
              </div>

              {/* Number of Athletes Selector */}
              <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div>
                  <label className="block text-xs font-semibold text-navy">Number of Athletes</label>
                  <p className="text-[11px] text-slate-400">You can add or edit athletes anytime later from the Athletes page.</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={athleteCount}
                    onChange={(e) => handleAthleteCountChange(parseInt(e.target.value, 10) || 1)}
                    className="h-10 w-20 rounded-lg border border-slate-300 bg-white px-3 text-center text-sm font-bold text-navy outline-none focus:border-teal"
                  />
                  <span className="text-xs font-medium text-slate-500">athletes</span>
                </div>
              </div>

              {/* Athletes Form List */}
              <div className="mt-6 space-y-4">
                {athleteDrafts.map((draft, idx) => {
                  const categories = getCategoriesForSport(effectiveSport)
                  const athleteCat =
                    categories.includes(draft.category) || (selectedCategory === 'Other' && draft.category === effectiveCategory)
                      ? draft.category
                      : effectiveCategory

                  return (
                    <div
                      key={draft.id}
                      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">
                            {idx + 1}
                          </span>
                          <h3 className="text-xs font-bold uppercase tracking-wide text-navy">
                            Athlete {String(idx + 1).padStart(2, '0')}
                          </h3>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal">
                            {effectiveSport}
                          </span>
                        </div>
                        {athleteDrafts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveAthlete(idx)}
                            className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                            title="Remove this athlete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Remove</span>
                          </button>
                        )}
                      </div>

                      <div className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                        {/* Full Name */}
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-navy">
                            Full Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Arun Kumar"
                            value={draft.name}
                            onChange={(e) => handleUpdateAthlete(idx, { name: e.target.value })}
                            className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-teal"
                          />
                        </div>

                        {/* Athlete ID */}
                        <div>
                          <label className="block text-xs font-semibold text-navy">
                            Athlete ID <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. ATH-001"
                            value={draft.athleteId}
                            onChange={(e) => handleUpdateAthlete(idx, { athleteId: e.target.value })}
                            className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-mono font-medium outline-none focus:border-teal"
                          />
                        </div>

                        {/* Category / Discipline */}
                        <div>
                          <label className="block text-xs font-semibold text-navy">Category / Discipline</label>
                          <select
                            value={athleteCat}
                            onChange={(e) => handleUpdateAthlete(idx, { category: e.target.value })}
                            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs outline-none focus:border-teal"
                          >
                            {categories.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                            {selectedCategory === 'Other' && !categories.includes(effectiveCategory) && (
                              <option value={effectiveCategory}>{effectiveCategory}</option>
                            )}
                          </select>
                        </div>
                      </div>

                      {/* Optional details row */}
                      <div className="mt-3 grid gap-3.5 sm:grid-cols-3">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500">
                            Position / Event <span className="text-slate-400 font-normal">(Optional)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 100m Sprint"
                            value={draft.positionEvent}
                            onChange={(e) => handleUpdateAthlete(idx, { positionEvent: e.target.value })}
                            className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs outline-none focus:border-teal"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-500">
                            Age <span className="text-slate-400 font-normal">(Optional)</span>
                          </label>
                          <input
                            type="number"
                            min={10}
                            max={80}
                            placeholder="e.g. 24"
                            value={draft.age}
                            onChange={(e) => handleUpdateAthlete(idx, { age: e.target.value })}
                            className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs outline-none focus:border-teal"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-500">
                            Wearable Sensor ID <span className="text-slate-400 font-normal">(Optional)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Assign later / No sensor"
                            value={draft.sensorId}
                            onChange={(e) => handleUpdateAthlete(idx, { sensorId: e.target.value })}
                            className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-mono outline-none focus:border-teal"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Add Athlete Button */}
              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleAddAthlete}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-teal hover:bg-slate-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Another Athlete
                </button>
                <span className="text-xs text-slate-400">{athleteDrafts.length} athletes configured</span>
              </div>

              {/* Navigation */}
              <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null)
                    setCurrentStep('sport')
                  }}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 px-4 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <button
                  type="submit"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy px-6 text-xs font-semibold text-white transition hover:bg-slate-800"
                >
                  Next: Review Team
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </form>
        )}

        {/* STEP 04: REVIEW & CONFIRM */}
        {currentStep === 'review' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
              <div className="border-b border-slate-100 pb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-teal">Step 04 of 04</span>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-navy">
                  Review & Confirm Your Team Setup
                </h1>
                <p className="mt-1 text-xs text-slate-500">
                  Please confirm your team information. When you click "Create Team", real records will be persisted to your Supabase backend.
                </p>
              </div>

              {/* Team Summary Card */}
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/70 p-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-teal" />
                    <h2 className="text-sm font-bold text-navy">TEAM PROFILE</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep('team')}
                    className="text-xs font-semibold text-teal hover:underline"
                  >
                    Edit Team
                  </button>
                </div>

                <dl className="mt-4 grid gap-3 sm:grid-cols-3 text-xs">
                  <div>
                    <dt className="text-slate-400">Team Name</dt>
                    <dd className="mt-0.5 font-semibold text-navy">{teamName}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Head Coach</dt>
                    <dd className="mt-0.5 font-semibold text-navy">{coachName}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Sport & Discipline</dt>
                    <dd className="mt-0.5 font-semibold text-navy">
                      {effectiveSport} ({effectiveCategory})
                    </dd>
                  </div>
                  {countryRegion && (
                    <div>
                      <dt className="text-slate-400">Region</dt>
                      <dd className="mt-0.5 font-medium text-slate-700">{countryRegion}</dd>
                    </div>
                  )}
                  {description && (
                    <div className="sm:col-span-2">
                      <dt className="text-slate-400">Description</dt>
                      <dd className="mt-0.5 text-slate-600">{description}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Athlete Roster Review List */}
              <div className="mt-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-teal" />
                    <h2 className="text-sm font-bold text-navy">ATHLETE ROSTER ({athleteDrafts.length})</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep('athletes')}
                    className="text-xs font-semibold text-teal hover:underline"
                  >
                    Edit Athletes
                  </button>
                </div>

                <div className="mt-3 divide-y divide-slate-100">
                  {athleteDrafts.map((athlete, idx) => (
                    <div key={athlete.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-navy">{athlete.name}</p>
                          <p className="text-[11px] text-slate-400">
                            {athlete.athleteId} · {effectiveSport} ({athlete.category})
                            {athlete.positionEvent ? ` · ${athlete.positionEvent}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          <Radio className="h-3 w-3 text-slate-400" />
                          {athlete.sensorId ? athlete.sensorId : 'Sensor: Not Assigned'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hardware Note */}
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-teal/20 bg-teal/5 p-4 text-xs text-slate-700">
                <Info className="h-4 w-4 shrink-0 text-teal mt-0.5" />
                <p>
                  <strong>Hardware telemetry workflow:</strong> Athletes will be registered in your Supabase database immediately. Wearable ear sensors and ESP32 gateway devices can be assigned or paired whenever your physical hardware is connected.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setCurrentStep('athletes')}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 px-4 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Athletes
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleFinalSubmit}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal px-7 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-dark disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Creating your team in Supabase…
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Create Team & Save Roster
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 05: COMPLETE */}
        {currentStep === 'complete' && (
          <div className="rounded-2xl border border-emerald-200 bg-white p-8 sm:p-12 text-center shadow-lg">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <h1 className="mt-6 text-2xl font-bold tracking-tight text-navy">
              Your team is ready.
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {createdCount} athletes have been added to ThermoTrack under{' '}
              <span className="font-semibold text-navy">{teamName}</span>.
            </p>

            {/* Summary Cards */}
            <div className="mx-auto mt-8 grid max-w-md grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <p className="text-2xl font-bold text-navy">{createdCount}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Athletes
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <p className="text-2xl font-bold text-slate-400">0</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Devices
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <p className="text-2xl font-bold text-slate-400">0</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Alerts
                </p>
              </div>
            </div>

            <p className="mt-6 text-xs text-slate-400">
              Live monitoring will commence as soon as your ESP32 hardware transmits packets.
            </p>

            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={handleFinishOnboarding}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-navy px-8 text-xs font-semibold text-white shadow-md transition hover:bg-slate-800"
              >
                Go to Dashboard
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
