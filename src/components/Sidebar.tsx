import { NavLink, useLocation } from 'react-router-dom'
import { APP_NAME, POWERED_BY, VERSION } from '../config'
import type { Role } from '../domain/role'
import type { Tone } from '../domain/tone'
import { NAV_GROUPS, NAV_TOP, type NavItem } from '../nav'
import { StateShape } from './StatusChip'

export type SidebarData = {
  /** Semáforo derivado por ruta de módulo (selectores de domain/derive). */
  tones?: Readonly<Record<string, Tone>>
  /** Contadores de pastilla por ruta (alertas nuevas, ARCOP nuevas sin asignar). */
  counters?: Readonly<Record<string, number>>
}

const base = (to: string) => to.split('/')[1] ?? ''

function Item({ item, role, collapsed, data, onNavigate }: { item: NavItem; role: Role; collapsed: boolean; data: SidebarData; onNavigate: () => void }) {
  const { pathname } = useLocation()
  const active = base(item.to) === base(pathname)
  const label = item.to === '/' && role === 'legal' ? 'Resumen' : item.label
  const tone = data.tones?.[item.to]
  const count = role === 'legal' ? undefined : data.counters?.[item.to]
  const procs = item.processes.join(' · ')
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      title={collapsed ? `${label}${procs ? ` · ${procs}` : ''}` : undefined}
      aria-current={active ? 'page' : undefined}
      className={`relative flex min-h-9 items-center gap-2.5 rounded-ctl px-3 py-1.5 text-dense ${
        active ? 'bg-brand-soft font-bold text-brand-deep' : 'text-ink hover:bg-sunken hover:text-ink'
      } ${collapsed ? 'justify-center' : ''}`}
      style={active ? { boxShadow: 'inset 3px 0 0 var(--brand)' } : undefined}
    >
      {tone !== undefined && (
        <span className={collapsed ? 'absolute right-2 top-2' : 'flex-none'}>
          <StateShape tone={tone} size={8} />
        </span>
      )}
      {collapsed ? (
        <span className="text-[15px] font-bold" aria-hidden="true">{label.slice(0, 2)}</span>
      ) : (
        <>
          <span className="min-w-0 flex-1 leading-[18px]">{label}</span>
          {count !== undefined && count > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-crit-ink px-1.5 text-[13.5px] font-bold text-white" aria-label={`${count} nuevas`}>
              {count}
            </span>
          )}
          {procs && <span className="flex-none font-mono text-[14px] text-ink-faint">{procs}</span>}
        </>
      )}
      {collapsed && <span className="sr-only">{label}</span>}
    </NavLink>
  )
}

export function Sidebar({
  role,
  collapsed,
  data = {},
  onNavigate,
}: {
  role: Role
  collapsed: boolean
  data?: SidebarData
  onNavigate: () => void
}) {
  const top = NAV_TOP.filter((i) => !(i.analistaOnly && role === 'legal'))
  return (
    <div className="flex h-full flex-col bg-surface">
      <div className={`flex items-center gap-3 border-b border-line-soft py-[18px] ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
        <img src={`${import.meta.env.BASE_URL}h2d-logo.png`} alt="H2D" width={44} height={44} className="h-11 w-11 flex-none rounded-ctl object-contain" />
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-[19px] font-extrabold">{APP_NAME}</div>
            <div className="text-[14px] text-ink-soft">{POWERED_BY}</div>
          </div>
        )}
      </div>
      <nav aria-label="Principal" className="flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-0.5">
          {top.map((i) => <Item key={i.to} item={i} role={role} collapsed={collapsed} data={data} onNavigate={onNavigate} />)}
        </div>
        {NAV_GROUPS.map((g) => (
          <div key={g.title} className="mt-5">
            {collapsed ? (
              <hr className="mx-2 mb-2 border-line-soft" />
            ) : (
              <div className="mb-1.5 px-3 text-[13px] font-bold uppercase tracking-[0.06em] text-ink-soft">{g.title}</div>
            )}
            <div className="space-y-0.5">
              {g.items.map((i) => <Item key={i.to} item={i} role={role} collapsed={collapsed} data={data} onNavigate={onNavigate} />)}
            </div>
          </div>
        ))}
      </nav>
      <div className={`border-t border-line-soft py-3 font-mono text-[14px] text-ink-soft ${collapsed ? 'text-center' : 'px-5'}`}>v{VERSION}</div>
    </div>
  )
}
