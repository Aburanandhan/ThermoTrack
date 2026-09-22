import type { ReactNode } from 'react'
import { formatTimestamp } from '../../lib/format'
import type { DataStreamStatus, DeviceStatus } from '../../types/monitoring'
import { ConnectionStatus } from './ConnectionStatus'

interface LiveStatusBarProps {
  devices: DeviceStatus[]
  stream: DataStreamStatus
}

export function LiveStatusBar({ devices, stream }: LiveStatusBarProps) {
  const connected = devices.some((device) => device.connected)
  const connectionState = connected ? 'connected' : devices.length ? 'disconnected' : 'waiting'

  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
      <StatusCell label="Live Monitoring">
        <span
          className={`text-sm font-semibold inline-flex items-center gap-1.5 ${
            connected ? 'text-emerald-700' : 'text-slate-500'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              connected ? 'bg-emerald-500 animate-pulse' : 'border border-slate-400'
            }`}
          />
          {connected ? 'LIVE MONITORING' : 'WAITING FOR DEVICES'}
        </span>
      </StatusCell>
      <StatusCell label="ESP32 Connection">
        <ConnectionStatus state={connectionState} compact />
        <p className="text-xs text-slate-500">
          {connected ? 'Device connected' : 'Waiting for device'}
        </p>
      </StatusCell>
      <StatusCell label="Data Stream">
        <p className="text-sm font-medium text-slate-700">{connected ? 'Receiving' : 'No data'}</p>
      </StatusCell>
      <StatusCell label="Last Update">
        <p className="text-sm font-medium tabular-nums text-slate-700">{formatTimestamp(stream.lastUpdate)}</p>
      </StatusCell>
    </div>
  )
}

function StatusCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  )
}
