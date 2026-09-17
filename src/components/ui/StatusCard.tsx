import { cn } from '../../lib/cn'

interface StatusCardProps {
  label: string
  value: string
  hint: string
  className?: string
}

export function StatusCard({ label, value, hint, className }: StatusCardProps) {
  return (
    <article
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md',
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-navy">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{hint}</p>
    </article>
  )
}
