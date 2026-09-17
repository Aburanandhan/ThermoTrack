import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { OnboardingGuard } from './components/layout/OnboardingGuard'
import { AuthProvider } from './context/AuthContext'
import { MonitoringProvider } from './context/MonitoringContext'
import { AthleteDetailPage } from './pages/AthleteDetailPage'
import { AthletesPage } from './pages/AthletesPage'
import { CalendarPage } from './pages/CalendarPage'
import { HelpPage } from './pages/HelpPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { OverviewPage } from './pages/OverviewPage'
import { ProfilePage } from './pages/ProfilePage'
import { SessionBuildPage } from './pages/SessionBuildPage'
import { SignInPage } from './pages/SignInPage'

export default function App() {
  return (
    <AuthProvider>
      <MonitoringProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/sign-in" element={<SignInPage />} />
            <Route path="/signup" element={<SignInPage />} />
            <Route path="/forgot-password" element={<SignInPage />} />

            <Route path="/onboarding" element={<OnboardingPage />} />

            <Route element={<OnboardingGuard />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/overview" element={<Navigate to="/" replace />} />
                <Route path="/athletes" element={<AthletesPage />} />
                <Route path="/athletes/:athleteId" element={<AthleteDetailPage />} />
                <Route path="/session-build" element={<SessionBuildPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/help" element={<HelpPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </MonitoringProvider>
    </AuthProvider>
  )
}
