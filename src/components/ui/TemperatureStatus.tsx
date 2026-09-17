import { temperatureStatusLabel } from '../../lib/status'
import type { TemperatureStatusKey } from '../../types/monitoring'
import { cn } from '../../lib/cn'

interface TemperatureStatusProps {
  status: TemperatureStatusKey
}

const styles: Record<TemperatureStatusKey, string> = {
  good: 'bg-teal/10 text-teal-dark border-teal/30',
  monitor: 'bg-amber-50 text-amber-700 border-amber-200',
  caution: 'bg-red-50 text-red-700 border-red-200',
  no_data: 'bg-slate-100 text-slate-500 border-slate-200',
}

export function TemperatureStatus({ status }: TemperatureStatusProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
        styles[status],
      )}
    >
      {status === 'no_data' ? 'No Data' : temperatureStatusLabel(status)}
    </span>
  )
}
