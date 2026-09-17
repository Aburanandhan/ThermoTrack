import { CalendarDays, ClipboardList, LayoutDashboard, UserRound, Users } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '../../lib/cn'

const items = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/athletes', label: 'Athletes', icon: Users, end: false },
  { to: '/session-build', label: 'Session', icon: ClipboardList, end: false },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, end: false },
  { to: '/profile', label: 'Profile', icon: UserRound, end: false },
]

export function MobileNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-2 py-1.5 lg:hidden"
      aria-label="Mobile"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium',
                  isActive ? 'text-teal-dark' : 'text-slate-500',
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
