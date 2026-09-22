import { formatOptional, formatTimestamp } from '../../lib/format'
import { connectionFromDevice, connectionLabel } from '../../lib/status'
import type { DeviceStatus } from '../../types/monitoring'
import { ConnectionStatus } from './ConnectionStatus'

interface DeviceStatusCardProps {
  device?: DeviceStatus
  sensorId?: string | null
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-navy">{value}</span>
    </div>
  )
}

export function DeviceStatusCard({ device, sensorId }: DeviceStatusCardProps) {
  const state = connectionFromDevice(device)

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-navy">Device Information</h3>
      <div className="mt-2">
        <ConnectionStatus state={state} />
      </div>
      <div className="mt-2">
        <Row label="ESP32 Device ID" value={formatOptional(device?.deviceId)} />
        <Row label="Temperature Sensor ID" value={formatOptional(sensorId ?? device?.sensorId)} />
        <Row label="Connection Status" value={device ? connectionLabel(state) : 'Not available'} />
        <Row label="Last Packet" value={formatTimestamp(device?.lastPacket)} />
        <Row
          label="Signal Strength"
          value={device?.signalStrength == null ? 'Not available' : `${device.signalStrength} dBm`}
        />
        <Row
          label="Battery"
          value={device?.battery == null ? 'Not available' : `${device.battery}%`}
        />
      </div>
    </section>
  )
}
