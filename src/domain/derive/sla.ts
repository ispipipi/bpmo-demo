import { addDays, diffDays } from '../../lib/dates'
import type { Tone } from '../tone'
import type {
  ArcopRequest,
  Consent,
  DemoState,
  ISODate,
  Params,
  Project,
  Rat,
  RatRequest,
  ScreeningAnswers,
  Vendor,
} from '../types'

/** Días hasta el vencimiento; negativo = vencido hace N días. */
export const daysLeft = (dueAt: ISODate, clock: ISODate): number => diffDays(clock, dueAt)

/** Semáforo de plazo: vencido (rojo), dentro del umbral (amarillo), en plazo (verde). */
export function slaTone(dueAt: ISODate, clock: ISODate, threshold: number): Tone {
  const left = daysLeft(dueAt, clock)
  if (left < 0) return 'crit'
  return left <= threshold ? 'warn' : 'ok'
}

/* ---------- ARCOP ---------- */
export const arcopDue = (r: ArcopRequest, p: Params): ISODate => addDays(r.receivedAt, p.arcopDays + (r.extension?.days ?? 0))
export const isArcopOpen = (r: ArcopRequest): boolean => r.status !== 'Cerrada'
export const arcopTone = (r: ArcopRequest, s: DemoState): Tone => slaTone(arcopDue(r, s.params), s.clock, s.params.dueSoonDays)
export const arcopClosedInTime = (r: ArcopRequest, p: Params): boolean | null =>
  r.closedAt === null ? null : r.closedAt <= arcopDue(r, p)

/* ---------- RAT ---------- */
export const ratRequestDue = (r: RatRequest, p: Params): ISODate => addDays(r.receivedAt, p.ratValidationDays)
export const isRatRequestOpen = (r: RatRequest): boolean => r.status !== 'Rechazada' && r.status !== 'Registrada'
export const ratRequestTone = (r: RatRequest, s: DemoState): Tone => slaTone(ratRequestDue(r, s.params), s.clock, s.params.dueSoonDays)
export const ratReviewDue = (rat: Rat, p: Params): ISODate => addDays(rat.reviewedAt, p.ratReviewDays)
export const ratReviewTone = (s: DemoState): Tone => slaTone(ratReviewDue(s.data.rat, s.params), s.clock, s.params.dueSoonDays)

/* ---------- Consentimientos ---------- */
export type ConsentStatus = 'Vigente' | 'Por validar' | 'Con revocaciones'
export const consentExpiry = (c: Consent, p: Params): ISODate => addDays(c.lastValidatedAt, p.consentValidityDays)
export const revocationsInLast = (c: Consent, clock: ISODate, days: number): number =>
  c.movements.filter((m) => m.kind === 'Revocación' && m.date >= addDays(clock, -days) && m.date <= clock).reduce((n, m) => n + m.quantity, 0)

export function consentStatus(c: Consent, s: DemoState): ConsentStatus {
  if (s.clock > consentExpiry(c, s.params)) return 'Por validar'
  return revocationsInLast(c, s.clock, 30) > 0 ? 'Con revocaciones' : 'Vigente'
}

/** Amarillo si la validación venció o vence dentro del umbral; si no, verde. Nunca rojo. */
export function consentTone(c: Consent, s: DemoState): Tone {
  return daysLeft(consentExpiry(c, s.params), s.clock) <= s.params.dueSoonDays ? 'warn' : 'ok'
}

/* ---------- Proveedores ---------- */
export const hasGuarantee = (v: Vendor): boolean => v.guarantee !== null
export const vendorDue = (v: Vendor): ISODate | null => {
  const dates = [v.contractExpiresAt, v.dpaExpiresAt].filter((x): x is ISODate => x !== null)
  return dates.length === 0 ? null : dates.reduce((a, b) => (a <= b ? a : b))
}

export function vendorTone(v: Vendor, s: DemoState): Tone {
  if (v.dpa !== 'Vigente') return 'crit'
  if (v.international && !hasGuarantee(v)) return 'crit'
  const due = vendorDue(v)
  if (due === null) return 'ok'
  const left = daysLeft(due, s.clock)
  if (left < 0) return 'crit'
  return left <= s.params.vendorNoticeDays ? 'warn' : 'ok'
}

/* ---------- Matriz de riesgo ---------- */
export type Risk = 'Alto' | 'Medio' | 'Bajo'
export type Screening = { risk: Risk; requiresEipd: boolean; channels: ('RAT' | 'Consentimientos' | 'Proveedores y transferencias')[] }

/** Preguntas: 1 RAT, 2 consentimiento, 3 transferencia internacional, 4 datos sensibles, 5 proveedor nuevo. */
export function screening(a: ScreeningAnswers): Screening | null {
  if (a.some((x) => x === null)) return null
  const yes = a.filter((x) => x === true).length
  const risk: Risk = a[3] === true || yes >= 3 ? 'Alto' : yes >= 1 ? 'Medio' : 'Bajo'
  const channels: Screening['channels'] = []
  if (a[0]) channels.push('RAT')
  if (a[1]) channels.push('Consentimientos')
  if (a[2] || a[4]) channels.push('Proveedores y transferencias')
  return { risk, requiresEipd: risk === 'Alto', channels }
}

export const isEvaluated = (p: Project): boolean => p.evaluatedAt !== null
