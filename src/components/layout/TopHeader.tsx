import { Menu, Search } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useMonitoring } from '../../context/MonitoringContext'
import { NotificationPanel } from '../ui/NotificationPanel'
import { ProfileMenu } from '../ui/ProfileMenu'

interface TopHeaderProps {
  title: string
  subtitle: string
  onMenu?: () => void
  actions?: ReactNode
}

export function TopHeader({ title, subtitle, onMenu, actions }: TopHeaderProps) {
  const { alerts } = useMonitoring()
  const [query, setQuery] = useState('')

  const onSearch = (event: FormEvent) => {
    event.preventDefault()
  }

  return (
    <header className="flex flex-col gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex items-start gap-3">
        {onMenu ? (
          <button
            type="button"
            className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 lg:hidden"
            onClick={onMenu}
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
        ) : null}
        <div>
          <h1 className="text-xl font-semibold text-navy">{title}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <form onSubmit={onSearch} className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search"
            className="h-10 w-52 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-navy outline-none transition focus:border-teal focus:bg-white"
          />
        </form>
        <NotificationPanel alerts={alerts} />
        <ProfileMenu />
      </div>
    </header>
  )
}
