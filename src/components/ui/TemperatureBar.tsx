import { resolveTemperatureStatus } from '../../lib/status'
import type { TemperatureThresholds } from '../../types/monitoring'

interface TemperatureBarProps {
  temperature: number | null | undefined
  thresholds: TemperatureThresholds
}

export function TemperatureBar({ temperature, thresholds }: TemperatureBarProps) {
  if (temperature === null || temperature === undefined) {
    return <p className="text-xs text-slate-400">No temperature data</p>
  }

  const status = resolveTemperatureStatus(temperature, thresholds)
  const min = thresholds.normal.min ?? thresholds.monitor.min ?? 34
  const max = thresholds.caution.max ?? thresholds.monitor.max ?? 41
  const span = Math.max(max - min, 0.1)
  const pct = Math.min(100, Math.max(0, ((temperature - min) / span) * 100))

  const color =
    status === 'caution' ? 'bg-red-500' : status === 'monitor' ? 'bg-amber-500' : 'bg-teal'

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}
