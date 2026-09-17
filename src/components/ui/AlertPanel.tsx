import { Bell, Check } from 'lucide-react'
import { formatTimestamp } from '../../lib/format'
import type { MonitoringAlert } from '../../types/monitoring'
import { EmptyState } from './EmptyState'

interface AlertPanelProps {
  alerts: MonitoringAlert[]
}

const KIND_LABEL: Record<MonitoringAlert['kind'], string> = {
  temperature_threshold: 'Temperature threshold exceeded',
  rapid_increase: 'Rapid temperature increase',
  sensor_disconnected: 'Sensor disconnected',
  no_data: 'No data received',
  device_reconnected: 'Device reconnected',
}

export function AlertPanel({ alerts }: AlertPanelProps) {
  return (
    <aside className="flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-navy">Alerts</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">Real-time athlete and device notifications</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {alerts.length === 0 ? (
          <EmptyState
            className="border-0 bg-transparent py-12"
            icon={<Check className="h-7 w-7 text-teal" />}
            title="No active alerts"
            description="No current alerts from connected devices."
          />
        ) : (
          <ul className="space-y-3">
            {alerts.map((alert) => (
              <li key={alert.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-sm font-medium text-navy">{KIND_LABEL[alert.kind]}</p>
                <p className="mt-1 text-xs text-slate-500">{alert.message}</p>
                <p className="mt-2 text-[11px] text-slate-400">{formatTimestamp(alert.timestamp)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
