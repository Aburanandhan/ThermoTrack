import { Link } from 'react-router-dom'
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
}

export function AthleteRow({ athlete, readings, devices, thresholds }: AthleteRowProps) {
  const reading = latestReadingForAthlete(readings, athlete.id)
  const device = deviceForAthlete(devices, athlete)
  const connection = connectionFromDevice(device)
  const tempStatus = resolveTemperatureStatus(reading?.temperature, thresholds)

  return (
    <Link
      to={`/athletes/${athlete.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)] lg:items-center lg:gap-6 lg:px-5"
    >
      <div className="flex items-start gap-3">
        <Tooltip content={connectionLabel(connection)}>
          <ConnectionStatus state={connection} compact showLabel={false} />
        </Tooltip>
        <div>
          <p className="font-semibold text-navy">{athlete.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {athlete.athleteId}
            {athlete.sport ? ` · ${athlete.sport}` : ''}
            {athlete.category ? ` (${athlete.category})` : ''}
          </p>
          <p className="text-xs text-slate-400">
            Sensor: {athlete.sensorId ? athlete.sensorId : <span className="italic text-slate-400">Not Assigned</span>}
          </p>
        </div>
      </div>

      <div className="mt-4 lg:mt-0">
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

      <div className="mt-4 space-y-1 lg:mt-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Device</p>
        <ConnectionStatus state={connection} compact />
        <p className="text-xs text-slate-500">{connectionLabel(connection)}</p>
      </div>

      <div className="mt-4 lg:mt-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Last updated</p>
        <p className="mt-1 text-sm text-slate-600">{formatTimestamp(reading?.timestamp ?? device?.lastPacket)}</p>
      </div>
    </Link>
  )
}
