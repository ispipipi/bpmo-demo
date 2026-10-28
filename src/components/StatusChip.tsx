import type { ReactNode } from 'react'
import type { Tone } from '../domain/tone'
import { IconLock } from './Icons'

export type Severity = 'Crítica' | 'Alta' | 'Media' | 'Informativa'

const TONE_TEXT: Record<Tone, string> = {
  ok: 'En plazo',
  warn: 'Por vencer',
  crit: 'Vencido',
  na: 'No incluido',
  info: 'Informativo',
}

const TONE_CLASS: Record<Tone, string> = {
  ok: 'bg-ok-soft text-ok-ink',
  warn: 'bg-warn-soft text-warn-ink',
  crit: 'bg-crit-soft text-crit-ink',
  na: 'bg-sunken text-ink-soft',
  info: 'bg-sunken text-ink-soft',
}

const SHAPE_COLOR: Record<Tone, string> = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  crit: 'var(--crit)',
  na: 'var(--ink-3)',
  info: 'var(--ink-2)',
}

/** Forma de estado: círculo (ok), triángulo (warn), rombo (crit), anillo (na), i (info). Nunca solo color. */
export function StateShape({ tone, size = 8 }: { tone: Tone; size?: number }) {
  const c = SHAPE_COLOR[tone]
  const common = { width: size, height: size, viewBox: '0 0 10 10', 'aria-hidden': true, focusable: false as const, className: 'flex-none' }
  switch (tone) {
    case 'ok':
      return <svg {...common}><circle cx="5" cy="5" r="4.5" fill={c} /></svg>
    case 'warn':
      return <svg {...common}><path d="M5 .8 9.6 9H.4z" fill={c} /></svg>
    case 'crit':
      return <svg {...common}><path d="M5 0 10 5 5 10 0 5z" fill={c} /></svg>
    case 'info':
      return <svg {...common}><circle cx="5" cy="5" r="4.1" fill="none" stroke={c} strokeWidth="1.2" /><path d="M5 4.4v2.6M5 3h.01" stroke={c} strokeWidth="1.2" strokeLinecap="round" /></svg>
    case 'na':
      return <svg {...common}><circle cx="5" cy="5" r="3.7" fill="none" stroke={c} strokeWidth="1.4" /></svg>
  }
}

const SIZE: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-6 px-2.5 gap-1.5',
  md: 'h-7 px-3 gap-1.5',
  lg: 'h-[34px] px-3.5 gap-2',
}

export function StatusChip({
  tone,
  label,
  size = 'sm',
}: {
  tone: Tone
  label?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const text = label ?? TONE_TEXT[tone]
  return (
    <span
      className={`inline-flex flex-none items-center whitespace-nowrap rounded-full text-label ${SIZE[size]} ${TONE_CLASS[tone]}`}
      role="status"
      aria-label={typeof text === 'string' ? `Estado: ${text}` : undefined}
    >
      {tone === 'na' ? <IconLock size={13} /> : <StateShape tone={tone} size={size === 'lg' ? 11 : 9} />}
      {text}
    </span>
  )
}

const SEV_CLASS: Record<Severity, string> = {
  Crítica: 'bg-crit-ink text-white',
  Alta: 'bg-crit-soft text-crit-ink',
  Media: 'bg-warn-soft text-warn-ink',
  Informativa: 'bg-sunken text-ink-soft',
}

const SEV_TONE: Record<Severity, Tone> = { Crítica: 'crit', Alta: 'crit', Media: 'warn', Informativa: 'info' }

export function SeverityChip({ severity, count }: { severity: Severity; count?: number }) {
  return (
    <span className={`inline-flex h-6 flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-label ${SEV_CLASS[severity]}`}>
      {severity === 'Crítica' ? (
        <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 0 10 5 5 10 0 5z" fill="#fff" /></svg>
      ) : (
        <StateShape tone={SEV_TONE[severity]} size={9} />
      )}
      {severity}
      {count !== undefined && <span className="tabular-nums">{count}</span>}
    </span>
  )
}
