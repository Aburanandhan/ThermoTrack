import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { MobileNav } from './MobileNav'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-svh bg-canvas text-navy">
      <div className="flex min-h-svh">
        <div className="hidden lg:block">
          <div className="sticky top-0 h-svh">
            <Sidebar />
          </div>
        </div>

        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-navy/40"
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
            />
            <div className="relative h-full w-[240px]">
              <Sidebar onNavigate={() => setOpen(false)} />
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col pb-16 lg:pb-0">
          <Outlet context={{ openNav: () => setOpen(true) }} />
        </div>
      </div>
      <MobileNav />
    </div>
  )
}
