const pad = (n: number) => String(n).padStart(2, '0')

/** ISO yyyy-mm-dd -> dd/mm/aaaa (es-CL). Sin conversión de zona horaria. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return '—'
  return `${d}/${m}/${y}`
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

export function diffDays(fromIso: string, toIso: string): number {
  const f = (s: string) => {
    const [y, m, d] = s.split('-').map(Number) as [number, number, number]
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((f(toIso) - f(fromIso)) / 86_400_000)
}

/** Suma años de calendario; el 29 de febrero cae el 28 en años no bisiestos. */
export function addYears(iso: string, years: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const ty = y + years
  const last = new Date(Date.UTC(ty, m, 0)).getUTCDate()
  return `${ty}-${pad(m)}-${pad(Math.min(d, last))}`
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export const monthStart = (iso: string): string => `${iso.slice(0, 7)}-01`

/** "Febrero 2027" a partir de una fecha ISO. */
export function monthTitle(iso: string): string {
  const [y, m] = iso.split('-').map(Number) as [number, number]
  const name = MONTHS[m - 1] ?? ''
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`
}
