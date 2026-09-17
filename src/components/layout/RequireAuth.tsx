import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export function RequireAuth() {
  const { authStatus, loading } = useAuth()

  if (loading || authStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal border-t-transparent mx-auto" />
          <p className="mt-3 text-xs text-slate-500 font-medium tracking-wide">Loading ThermoTrack...</p>
        </div>
      </div>
    )
  }

  if (authStatus === 'unauthenticated') return <Navigate to="/signin" replace />
  return <Outlet />
}
