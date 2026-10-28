import type { ReactNode } from 'react'
import type { Tone } from '../domain/tone'
import { StateShape } from './StatusChip'

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: readonly { value: string; label: string }[]
}) {
  return (
    <label className="inline-flex h-9 items-center gap-2 rounded-ctl bg-surface px-3 text-[13px] shadow-[inset_0_0_0_1.5px_var(--line)]">
      <span className="text-ink-soft">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="cursor-pointer bg-transparent pr-1 font-bold outline-none">
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}

export type ToneOption = { value: string; label: string; count: number; tone?: Tone }

const TONE_TEXT: Record<Tone, string> = { crit: 'text-crit-ink', warn: 'text-warn-ink', ok: 'text-ok-ink', na: 'text-ink-soft', info: 'text-ink-soft' }

/** Segmented de semáforo con conteos. Cada segmento lleva su forma de estado, nunca solo color. */
export function ToneSegmented({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: readonly ToneOption[]; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex h-9 max-w-full items-center gap-0.5 overflow-x-auto rounded-ctl bg-sunken p-1">
      {options.map((o): ReactNode => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-[7px] px-2.5 text-[12.5px] font-bold ${
              active ? 'bg-surface shadow-card' : 'hover:bg-surface/60'
            } ${o.tone ? TONE_TEXT[o.tone] : 'text-ink'}`}
          >
            {o.tone && <StateShape tone={o.tone} size={9} />}
            {o.label} <span className="tabular-nums">{o.count}</span>
          </button>
        )
      })}
    </div>
  )
}
