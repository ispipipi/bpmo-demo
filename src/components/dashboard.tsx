import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Tone } from '../domain/tone'
import { IconArrowRight } from './Icons'
import { StateShape, StatusChip } from './StatusChip'

/** Tarjeta de categoría. Con `to` entera es un enlace a su módulo; sin `to` contiene sus propios enlaces. */
export function KpiCard({
  tone,
  to,
  title,
  chip,
  className = '',
  children,
}: {
  tone: Tone
  to?: string
  title: string
  chip?: { tone: Tone; label: string }
  className?: string
  children?: ReactNode
}) {
  const cls = `kpi-card kpi-card--${tone} ${to ? 'kpi-card--link' : ''} block rounded-card p-5 text-ink ${className}`
  const body = (
    <>
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="text-overline uppercase text-ink-soft">{title}</h2>
        {chip && <StatusChip tone={chip.tone} label={chip.label} size="md" />}
      </div>
      {children}
    </>
  )
  return to ? (
    <Link to={to} className={`${cls} hover:text-ink`} aria-label={chip ? `${title}: ${chip.label}` : title}>{body}</Link>
  ) : (
    <section className={cls}>{body}</section>
  )
}

/** Cifra principal con su rótulo. `faint` para valores sin dato ("—", nunca 0 %). */
export function Figure({ value, unit, faint = false }: { value: ReactNode; unit?: ReactNode; faint?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
      <span className={`text-kpi ${faint ? 'text-ink-faint' : ''}`}>{value}</span>
      {unit && <span className="text-[16px] text-ink-soft">{unit}</span>}
    </div>
  )
}

const INK: Record<Tone, string> = { crit: 'text-crit-ink', warn: 'text-warn-ink', ok: 'text-ink', na: 'text-ink', info: 'text-ink' }

/** Fila de indicador; si dispara el estado lleva forma y color `*-ink`. */
export function KpiRow({ label, value, tone, to }: { label: string; value: ReactNode; tone?: Tone; to?: string }) {
  const shaped = tone === 'crit' || tone === 'warn'
  const content = (
    <>
      <span className="text-dense text-ink-soft">{label}</span>
      <span className={`flex items-center gap-1.5 text-dense font-bold ${tone ? INK[tone] : ''}`}>
        {shaped && <StateShape tone={tone} size={9} />}
        {value}
      </span>
    </>
  )
  const cls = 'flex items-center justify-between gap-3 border-t border-line-soft py-2'
  return to ? (
    <Link to={to} className={`${cls} rounded-sm text-ink hover:bg-brand-wash hover:text-ink`}>{content}</Link>
  ) : (
    <div className={cls}>{content}</div>
  )
}

export function MiniChip({ tone, muted = false, children }: { tone?: Tone; muted?: boolean; children: ReactNode }) {
  const color = muted || !tone ? 'bg-sunken text-ink-soft' : tone === 'crit' ? 'bg-crit-soft text-crit-ink' : tone === 'warn' ? 'bg-warn-soft text-warn-ink' : tone === 'ok' ? 'bg-ok-soft text-ok-ink' : 'bg-sunken text-ink-soft'
  return (
    <span className={`inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-label ${color}`}>
      {tone && tone !== 'na' && (muted ? <span className="opacity-50"><StateShape tone={tone} size={9} /></span> : <StateShape tone={tone} size={9} />)}
      {children}
    </span>
  )
}

export function SubCard({ to, title, process, children }: { to: string; title: string; process: string; children: ReactNode }) {
  return (
    <Link to={to} className="kpi-card kpi-card--ok kpi-card--link flex flex-col rounded-card p-5 text-ink hover:text-ink">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-[18px] font-bold leading-6">
          {title} <span className="font-mono text-[14px] font-normal text-ink-faint">{process}</span>
        </h3>
        <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
          <IconArrowRight size={13} />
        </span>
      </div>
      {children}
    </Link>
  )
}
