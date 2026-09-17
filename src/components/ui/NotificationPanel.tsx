import { Bell } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { MonitoringAlert } from '../../types/monitoring'
import { formatTimestamp } from '../../lib/format'

interface NotificationPanelProps {
  alerts: MonitoringAlert[]
}

export function NotificationPanel({ alerts }: NotificationPanelProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-navy"
      >
        <Bell className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <p className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Notifications</p>
          {alerts.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-slate-500">No notifications</p>
          ) : (
            <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto">
              {alerts.map((alert) => (
                <li key={alert.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-sm text-navy">{alert.message}</p>
                  <p className="text-[11px] text-slate-400">{formatTimestamp(alert.timestamp)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
