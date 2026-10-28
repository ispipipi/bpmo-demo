export type Tone = 'ok' | 'warn' | 'crit' | 'na' | 'info'

const RANK: Record<Tone, number> = { crit: 3, warn: 2, ok: 1, info: 0, na: 0 }

export function worstTone(tones: readonly Tone[]): Tone {
  let worst: Tone | undefined
  for (const t of tones) {
    if (t === 'na') continue
    if (worst === undefined || RANK[t] > RANK[worst]) worst = t
  }
  return worst ?? 'na'
}
