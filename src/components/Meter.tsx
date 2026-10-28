import type { Tone } from '../domain/tone'

const FILL: Record<Tone, string> = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  crit: 'var(--crit)',
  na: 'var(--ink-3)',
  info: 'var(--brand)',
}

export function Meter({ value, tone = 'info', width, label }: { value: number; tone?: Tone; width?: number; label: string }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className="h-2 overflow-hidden rounded-full bg-sunken"
      style={width ? { width } : undefined}
    >
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: FILL[tone] }} />
    </div>
  )
}

export function SegmentBar({
  segments,
  segmentWidth = 14,
  height = 8,
  label,
}: {
  segments: readonly { tone: Tone | 'empty' }[]
  segmentWidth?: number
  height?: number
  label: string
}) {
  return (
    <div role="img" aria-label={label} className="flex gap-[3px]">
      {segments.map((s, i) => (
        <span
          key={i}
          className="rounded-[3px]"
          style={{
            width: segmentWidth,
            height,
            background: s.tone === 'empty' ? 'var(--line)' : s.tone === 'info' ? 'var(--brand)' : FILL[s.tone],
          }}
        />
      ))}
    </div>
  )
}
