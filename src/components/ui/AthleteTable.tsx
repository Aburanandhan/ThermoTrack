import { Radio } from 'lucide-react'
import type { Athlete, DeviceStatus, TemperatureReading, TemperatureThresholds } from '../../types/monitoring'
import { AthleteRow } from './AthleteRow'
import { EmptyState } from './EmptyState'

interface AthleteTableProps {
  athletes: Athlete[]
  readings: TemperatureReading[]
  devices: DeviceStatus[]
  thresholds: TemperatureThresholds
}

export function AthleteTable({ athletes, readings, devices, thresholds }: AthleteTableProps) {
  if (athletes.length === 0) {
    return (
      <EmptyState
        icon={<Radio className="h-8 w-8" />}
        title="No athletes added yet"
        description="Register an athlete using the Add Athlete button to assign an in-ear sensor and begin monitoring."
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="hidden px-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)]">
        <span>Athlete</span>
        <span>Temperature</span>
        <span>Device</span>
        <span>Updated</span>
      </div>
      {athletes.map((athlete) => (
        <AthleteRow
          key={athlete.id}
          athlete={athlete}
          readings={readings}
          devices={devices}
          thresholds={thresholds}
        />
      ))}
    </div>
  )
}
