import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { DEMO_BANNER, POWERED_BY, VERSION, APP_NAME } from '../config'
import { sidebarData } from '../domain/derive/kpis'
import { useStore } from '../store/StoreProvider'
import { useToast } from './feedback'
import { IconInfo } from './Icons'
import { CrumbToneProvider } from './crumbTone'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { useShellLayout } from './useShellLayout'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <CrumbToneProvider>
      <Shell>{children}</Shell>
    </CrumbToneProvider>
  )
}

function Shell({ children }: { children: ReactNode }) {
  const { state, dispatch, storage, takeLoadNotice } = useStore()
  const toast = useToast()
  const side = useMemo(() => sidebarData(state), [state])
  const layout = useShellLayout()
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const isDrawer = layout.viewport === 'drawer'

  useEffect(() => {
    const notice = takeLoadNotice()
    if (notice) toast({ kind: 'error', text: notice })
  }, [takeLoadNotice, toast])

  const first = useRef(true)
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
    if (first.current) first.current = false
    else mainRef.current?.focus({ preventScroll: true })
  }, [pathname])

  const drawerRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (layout.drawerOpen) drawerRef.current?.querySelector<HTMLElement>('a,button')?.focus()
  }, [layout.drawerOpen])

  return (
    <div className="flex min-h-screen print:block">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-ctl focus:bg-surface focus:px-4 focus:py-2 focus:shadow-float">
        Saltar al contenido
      </a>

      {isDrawer ? (
        layout.drawerOpen && (
          <div className="fixed inset-0 z-40" style={{ background: 'var(--scrim)' }} onMouseDown={layout.closeDrawer}>
            <aside ref={drawerRef} role="dialog" aria-modal="true" aria-label="Menú" className="animate-drawer h-full w-[264px] border-r border-line" onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && layout.closeDrawer()}>
              <Sidebar role={state.role} collapsed={false} data={side} onNavigate={layout.closeDrawer} />
            </aside>
          </div>
        )
      ) : (
        <aside
          className="sticky top-0 hidden h-screen flex-none border-r border-line min-[900px]:block print:hidden"
          style={{ width: layout.collapsed ? 76 : 264 }}
        >
          <Sidebar role={state.role} collapsed={layout.collapsed} data={side} onNavigate={() => undefined} />
        </aside>
      )}

      <div className="flex h-screen min-w-0 flex-1 flex-col print:block print:h-auto">
        <div className="flex min-h-9 flex-none flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-ink px-4 py-1.5 text-center text-[14.5px] font-semibold text-white min-[640px]:text-[15px] print:hidden" role="note">
          <span>{DEMO_BANNER}</span>
          {state.role === 'legal' && <span className="rounded-full bg-white px-2.5 py-0.5 text-[14px] font-bold text-ink">Vista de solo lectura</span>}
          {storage !== 'ok' && (
            <span className="inline-flex items-center gap-1.5 text-[14.5px] font-semibold">
              <IconInfo size={14} />
              Los cambios no se conservarán al recargar
            </span>
          )}
        </div>
        <Header
          state={state}
          drawerMode={isDrawer}
          onToggleSidebar={layout.toggle}
          onRoleChange={(role) => dispatch({ type: 'setRole', role })}
        />
        <main ref={mainRef} id="contenido" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto px-4 pb-16 pt-4 outline-none min-[900px]:px-6 min-[1200px]:px-8 print:overflow-visible">
          <div className="flex max-w-[1440px] flex-col gap-5">
            {children}
            <footer className="font-mono text-[14px] text-ink-soft">{APP_NAME} v{VERSION} · {POWERED_BY}</footer>
          </div>
        </main>
      </div>
    </div>
  )
}
