import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface AccordionItemProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}

export function AccordionItem({ title, children, defaultOpen = false }: AccordionItemProps) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()
  const buttonId = useId()

  return (
    <div className="border-b border-slate-200 last:border-0">
      <h3>
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-semibold text-navy"
        >
          {title}
          <ChevronDown className={cn('h-4 w-4 text-slate-400 transition', open && 'rotate-180')} />
        </button>
      </h3>
      {open ? (
        <div id={panelId} role="region" aria-labelledby={buttonId} className="pb-4 text-sm leading-6 text-slate-600">
          {children}
        </div>
      ) : null}
    </div>
  )
}
