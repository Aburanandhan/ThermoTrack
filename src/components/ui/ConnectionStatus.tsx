import { connectionLabel } from '../../lib/status'
import type { ConnectionState } from '../../types/monitoring'
import { cn } from '../../lib/cn'

interface ConnectionStatusProps {
  state: ConnectionState
  compact?: boolean
  showLabel?: boolean
}

export function ConnectionStatus({
  state,
  compact = false,
  showLabel = true,
}: ConnectionStatusProps) {
  const label = connectionLabel(state)
  return (
    <span className={cn('inline-flex items-center gap-2', compact ? 'text-xs' : 'text-sm')}>
      <span
        aria-hidden="true"
        className={cn(
          'inline-block rounded-full border',
          compact ? 'h-2.5 w-2.5' : 'h-3 w-3',
          state === 'connected' && 'border-teal bg-teal',
          state === 'disconnected' && 'border-slate-400 bg-white',
          state === 'waiting' && 'border-slate-300 bg-transparent',
        )}
      />
      {showLabel ? (
        <span
          className={cn(
            'font-medium',
            state === 'connected' && 'text-teal-dark',
            state === 'disconnected' && 'text-slate-500',
            state === 'waiting' && 'text-slate-400',
          )}
        >
          {state === 'connected' ? 'CONNECTED' : state === 'disconnected' ? 'DISCONNECTED' : 'WAITING FOR DATA'}
        </span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </span>
  )
}
