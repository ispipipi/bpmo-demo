import type { Tone } from '../tone'
import type { ArcopRequest, ArcopStatus, ArcopType, DemoState, ISODate } from '../types'
import { arcopClosedInTime, arcopDue, arcopTone, daysLeft, isArcopOpen } from './sla'

export type ArcopView = {
  req: ArcopRequest
  due: ISODate
  open: boolean
  /** Días hasta el vencimiento; null si el caso está cerrado. */
  daysLeft: number | null
  /** Semáforo de SLA; null si el caso está cerrado (no tiene plazo vigente). */
  tone: Tone | null
  /** Resultado de un caso cerrado, con su forma de estado. */
  closed: { tone: Tone; label: string } | null
}

const TONE_ORDER: Record<Tone, number> = { crit: 0, warn: 1, ok: 2, info: 3, na: 3 }

export function arcopView(req: ArcopRequest, s: DemoState): ArcopView {
  const due = arcopDue(req, s.params)
  const open = isArcopOpen(req)
  if (open) return { req, due, open, daysLeft: daysLeft(due, s.clock), tone: arcopTone(req, s), closed: null }
  const closed =
    req.resolution === 'Improcedente'
      ? { tone: 'info' as const, label: 'Improcedente' }
      : arcopClosedInTime(req, s.params)
        ? { tone: 'ok' as const, label: 'Cerrada en plazo' }
        : { tone: 'crit' as const, label: 'Cerrada fuera de plazo' }
  return { req, due, open, daysLeft: null, tone: null, closed }
}

/** Orden por defecto: abiertas Rojo → Amarillo → Verde, luego días restantes asc; cerradas al final (C.3). */
export function compareDefault(a: ArcopView, b: ArcopView): number {
  if (a.open !== b.open) return a.open ? -1 : 1
  if (!a.open || !b.open) return (b.req.closedAt ?? '').localeCompare(a.req.closedAt ?? '') || a.req.id.localeCompare(b.req.id)
  const ta = TONE_ORDER[a.tone ?? 'ok']
  const tb = TONE_ORDER[b.tone ?? 'ok']
  return ta - tb || (a.daysLeft ?? 0) - (b.daysLeft ?? 0) || a.req.id.localeCompare(b.req.id)
}

export const arcopViews = (s: DemoState): ArcopView[] => s.data.arcop.map((r) => arcopView(r, s)).sort(compareDefault)

export type ArcopFilters = {
  q: string
  estado: 'todos' | 'abiertas' | ArcopStatus
  tipo: 'todos' | ArcopType
  sla: 'todos' | 'crit' | 'warn' | 'ok'
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const matches = (v: ArcopView, f: ArcopFilters): boolean => {
  const q = norm(f.q.trim())
  return (
    (q === '' || norm(v.req.id).includes(q) || norm(v.req.holder).includes(q)) &&
    (f.estado === 'todos' || (f.estado === 'abiertas' ? v.open : v.req.status === f.estado)) &&
    (f.tipo === 'todos' || v.req.type === f.tipo) &&
    (f.sla === 'todos' || v.tone === f.sla)
  )
}

export const filterArcop = (views: readonly ArcopView[], f: ArcopFilters): ArcopView[] => views.filter((v) => matches(v, f))

/** Conteos del semáforo sobre lo que cumple los demás filtros (el semáforo no se filtra a sí mismo). */
export function slaCounts(views: readonly ArcopView[], f: ArcopFilters): Record<'todos' | 'crit' | 'warn' | 'ok', number> {
  const base = views.filter((v) => matches(v, { ...f, sla: 'todos' }))
  const n = (t: Tone) => base.filter((v) => v.tone === t).length
  return { todos: base.length, crit: n('crit'), warn: n('warn'), ok: n('ok') }
}
