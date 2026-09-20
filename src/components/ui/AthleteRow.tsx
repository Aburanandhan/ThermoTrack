import { Link } from 'react-router-dom'
import { Cpu, Edit3 } from 'lucide-react'
import { formatTemperature, formatTimestamp } from '../../lib/format'
import {
  connectionFromDevice,
  connectionLabel,
  deviceForAthlete,
  latestReadingForAthlete,
  resolveTemperatureStatus,
} from '../../lib/status'
import type { Athlete, DeviceStatus, TemperatureReading, TemperatureThresholds } from '../../types/monitoring'
import { ConnectionStatus } from './ConnectionStatus'
import { TemperatureBar } from './TemperatureBar'
import { TemperatureStatus } from './TemperatureStatus'
import { Tooltip } from './Tooltip'

interface AthleteRowProps {
  athlete: Athlete
  readings: TemperatureReading[]
  devices: DeviceStatus[]
  thresholds: TemperatureThresholds
  onEdit?: (athlete: Athlete) => void
}

export function AthleteRow({ athlete, readings, devices, thresholds, onEdit }: AthleteRowProps) {
  const reading = latestReadingForAthlete(readings, athlete.id, athlete.sensorId)
  const device = deviceForAthlete(devices, athlete)
  const connection = connectionFromDevice(device)
  const tempStatus = resolveTemperatureStatus(reading?.temperature, thresholds)

  return (
    <div className="relative group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)] lg:items-center lg:gap-6 lg:px-5">
      <Link
        to={`/athletes/${athlete.id}`}
        className="absolute inset-0 z-0 rounded-xl"
        aria-label={`View details for ${athlete.name}`}
      />

      <div className="relative z-10 flex items-start justify-between sm:justify-start gap-3">
        <div className="flex items-start gap-3">
          <Tooltip content={connectionLabel(connection)}>
            <ConnectionStatus state={connection} compact showLabel={false} />
          </Tooltip>
          <div>
            <Link to={`/athletes/${athlete.id}`} className="font-semibold text-navy hover:text-teal">
              {athlete.name}
            </Link>
            <p className="mt-0.5 text-xs text-slate-500">
              {athlete.athleteId}
              {athlete.sport ? ` · ${athlete.sport}` : ''}
              {athlete.category ? ` (${athlete.category})` : ''}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">
                <Cpu className="h-3 w-3 text-slate-400" />
                Sensor: {athlete.sensorId ? athlete.sensorId : <span className="italic text-slate-400 font-sans">Not Assigned</span>}
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">
                Device: {athlete.deviceId ? athlete.deviceId : <span className="italic text-slate-400 font-sans">Not Assigned</span>}
              </span>
            </div>
          </div>
        </div>

        {onEdit ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onEdit(athlete)
            }}
            title="Edit athlete & hardware assignment"
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-teal hover:text-white hover:border-teal transition sm:hidden"
          >
            <Edit3 className="h-3 w-3" />
            Edit
          </button>
        ) : null}
      </div>

      <div className="relative z-10 mt-4 lg:mt-0">
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-navy">
          {formatTemperature(reading?.temperature)}
        </p>
        <div className="mt-1">
          <TemperatureStatus status={tempStatus} />
        </div>
        <div className="mt-2 max-w-[180px]">
          <TemperatureBar temperature={reading?.temperature} thresholds={thresholds} />
        </div>
      </div>

      <div className="relative z-10 mt-4 space-y-1 lg:mt-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Device Link</p>
        <ConnectionStatus state={connection} compact />
        <p className="text-xs text-slate-500">
          {athlete.deviceId ? athlete.deviceId : connectionLabel(connection)}
        </p>
      </div>

      <div className="relative z-10 mt-4 flex items-center justify-between lg:mt-0">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Last updated</p>
          <p className="mt-1 text-sm text-slate-600">{formatTimestamp(reading?.timestamp ?? device?.lastPacket)}</p>
        </div>

        {onEdit ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onEdit(athlete)
            }}
            title="Edit athlete & hardware assignment"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-teal hover:text-white hover:border-teal transition shadow-2xs"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit Hardware
          </button>
        ) : null}
      </div>
    </div>
  )
}
