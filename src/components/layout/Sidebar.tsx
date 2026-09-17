import {
  CalendarDays,
  CircleHelp,
  LayoutDashboard,
  Thermometer,
  UserRound,
  Users,
  ClipboardList,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useMonitoring } from '../../context/MonitoringContext'
import { cn } from '../../lib/cn'
import { ConnectionStatus } from '../ui/ConnectionStatus'

const primary = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/athletes', label: 'Athletes', icon: Users, end: false },
  { to: '/session-build', label: 'Session Build', icon: ClipboardList, end: false },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, end: false },
]

const secondary = [
  { to: '/help', label: 'Help', icon: CircleHelp },
  { to: '/profile', label: 'Profile', icon: UserRound },
]

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { devices } = useMonitoring()
  const connected = devices.some((d) => d.connected)
  const state = connected ? 'connected' : devices.length ? 'disconnected' : 'waiting'

  return (
    <aside className="flex h-full w-[240px] flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal text-white">
          <Thermometer className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-bold tracking-[0.12em] text-navy">THERMOTRACK</p>
        </div>
      </div>

      <nav className="flex-1 px-3" aria-label="Primary">
        <ul className="space-y-1">
          {primary.map((item) => (
            <li key={item.to}>
              <NavItem {...item} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
        <div className="my-4 border-t border-slate-200" />
        <ul className="space-y-1">
          {secondary.map((item) => (
            <li key={item.to}>
              <NavItem {...item} end={false} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-slate-200 px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Connected Devices</p>
        <div className="mt-2">
          <ConnectionStatus state={state} compact />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {connected ? 'Hardware linked' : 'Waiting for devices'}
        </p>
      </div>
    </aside>
  )
}

function NavItem({
  to,
  label,
  icon: Icon,
  end,
  onNavigate,
}: {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end: boolean
  onNavigate?: () => void
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
          isActive ? 'bg-teal/10 text-teal-dark' : 'text-slate-600 hover:bg-slate-50 hover:text-navy',
        )
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  )
}
