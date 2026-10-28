import { Link, useLocation } from 'react-router-dom'
import { CRUMBS } from '../nav'
import { useStore } from '../store/StoreProvider'
import { useCrumbToneValue } from './crumbTone'
import { IconChevronRight } from './Icons'

const CHIP = {
  brand: 'bg-brand-soft text-brand-deep',
  crit: 'bg-crit-soft text-crit-ink',
  warn: 'bg-warn-soft text-warn-ink',
  ok: 'bg-ok-soft text-ok-ink',
  info: 'bg-sunken text-ink-soft',
  na: 'bg-sunken text-ink-soft',
} as const

export function Breadcrumbs() {
  const { pathname } = useLocation()
  const { state } = useStore()
  const tone = useCrumbToneValue()
  const [seg = '', ...rest] = pathname.split('/').filter(Boolean)
  const [group, crumb] = CRUMBS[seg] ?? [null, 'BPMO']
  const module = seg === '' && state.role === 'legal' ? 'Resumen' : crumb
  const nested = rest[0] === 'hallazgo' || rest[0] === 'solicitud'
  const detail = rest[0] === 'parametros' ? 'Parámetros' : rest.length > 0 ? decodeURIComponent((nested ? rest[1] : rest[rest.length - 1]) ?? '') : null
  const modulePath = seg === 'reporteria' ? '/reporteria/1' : `/${seg}`
  const levels: { label: string; to?: string; current?: boolean; mono?: boolean }[] = []
  if (group) levels.push({ label: group })
  levels.push(detail ? { label: module, to: modulePath } : { label: module, current: true })
  if (detail && seg !== 'reporteria') levels.push({ label: detail, current: true, mono: detail !== 'Parámetros' })

  return (
    <nav aria-label="Migas de pan" className="flex min-w-0 items-center gap-1.5 text-dense text-ink-soft">
      {levels.map((l, i) => (
        <span key={i} className="flex min-w-0 items-center gap-1.5">
          {i > 0 && <IconChevronRight size={14} className="flex-none text-ink-faint" />}
          {l.current ? (
            <span aria-current="page" className={`truncate rounded-full px-3 py-1 text-label ${CHIP[l.current && l.mono && tone ? tone : 'brand']} ${l.mono ? 'font-mono' : ''}`}>
              {l.label}
            </span>
          ) : l.to ? (
            <Link to={l.to} className="truncate hover:underline">{l.label}</Link>
          ) : (
            <span className="truncate">{l.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
