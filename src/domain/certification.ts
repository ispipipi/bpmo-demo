import { addYears, formatDate } from '../lib/dates'
import { withLog } from './log'
import { err, ok, type Result } from './result'
import type { DemoState, HistoryEntry, Mpi, MpiItem, MpiItemState } from './types'

const ACTOR = 'Analista PMO'
export const MPI_STATES: readonly MpiItemState[] = ['Cumple', 'En progreso', 'No cumple', 'No aplica']
export const CERT_VALIDITY_YEARS = 3

export type MpiOp =
  | { kind: 'item'; itemId: string; state: MpiItemState; evidenceRef?: string; justification?: string; date?: string }
  | { kind: 'requested'; date: string; ref: string }
  | { kind: 'constancia'; date: string; ref: string }

/** Vencimiento de la certificación: constancia + 3 años (renovación trienal). Null sin constancia. */
export const mpiExpiry = (m: Mpi): string | null => (m.constanciaAt ? addYears(m.constanciaAt, CERT_VALIDITY_YEARS) : null)

const validDate = (s: DemoState, date: string, min?: string | null): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Ingresa una fecha válida.'
  if (date > s.clock) return 'La fecha no puede ser posterior a la fecha de demo.'
  if (min && date < min) return `La fecha no puede ser anterior al ${formatDate(min)}.`
  return null
}

export type ItemErrors = Partial<Record<'evidenceRef' | 'justification' | 'date', string>>

/** "Cumple" pide referencia de evidencia; "No aplica" pide justificación (MD §6.5.1). */
export function validateItemChange(s: DemoState, c: { state: MpiItemState; evidenceRef?: string; justification?: string; date?: string }): ItemErrors {
  const e: ItemErrors = {}
  if (c.state === 'Cumple' && (c.evidenceRef ?? '').trim() === '') e.evidenceRef = 'Indica la referencia de evidencia para marcar el ítem como "Cumple".'
  if (c.state === 'No aplica' && (c.justification ?? '').trim() === '') e.justification = 'Indica la justificación para marcar el ítem como "No aplica".'
  if ((c.state === 'Cumple' || c.state === 'No aplica') && c.date !== undefined) {
    const bad = validDate(s, c.date)
    if (bad) e.date = bad
  }
  return e
}

export type RefErrors = Partial<Record<'date' | 'ref', string>>
export function validateRefAndDate(s: DemoState, o: { date: string; ref: string }, min?: string | null): RefErrors {
  const e: RefErrors = {}
  const bad = validDate(s, o.date, min)
  if (bad) e.date = bad
  if (o.ref.trim() === '') e.ref = 'Indica la referencia.'
  return e
}

/** Por qué no se puede registrar la constancia vigente (solo con estado "Solicitada"). */
export const constanciaBlockers = (m: Mpi): string[] =>
  m.status === 'Solicitada' ? [] : [m.status === 'Vigente' ? 'La certificación ya está vigente.' : 'Se habilita con el estado "Solicitada".']

const note = (s: DemoState, text: string): HistoryEntry[] => [...s.data.mpi.history, { date: s.clock, actor: ACTOR, text }]

export function applyMpiOp(s: DemoState, op: MpiOp): Result<DemoState, string> {
  const mpi = s.data.mpi
  const set = (next: Mpi, log: string, entity: string) => ok(withLog({ ...s, data: { ...s.data, mpi: next } }, log, entity))

  switch (op.kind) {
    case 'item': {
      const item = mpi.items.find((i) => i.id === op.itemId)
      if (!item) return err(`No existe el ítem ${op.itemId}.`)
      if (item.state === op.state && op.state !== 'Cumple' && op.state !== 'No aplica') return err('El ítem ya está en ese estado.')
      const bad = Object.values(validateItemChange(s, op))[0]
      if (bad) return err(bad)
      const date = op.date ?? s.clock
      const next: MpiItem = {
        ...item,
        state: op.state,
        evidenceRef: op.state === 'Cumple' ? (op.evidenceRef ?? '').trim() : null,
        justification: op.state === 'No aplica' ? (op.justification ?? '').trim() : null,
        date: op.state === 'Cumple' || op.state === 'No aplica' ? date : null,
      }
      return set({ ...mpi, items: mpi.items.map((i) => (i.id === item.id ? next : i)), history: note(s, `${item.id}: ${item.state} → ${op.state}`) }, `${item.id} → ${op.state}`, item.id)
    }

    case 'requested': {
      if (mpi.status !== 'En preparación') return err('Solo se registra la solicitud con la certificación en preparación.')
      const bad = Object.values(validateRefAndDate(s, op))[0]
      if (bad) return err(bad)
      return set({ ...mpi, status: 'Solicitada', requestedAt: op.date, expedienteRef: op.ref.trim(), history: note(s, `Solicitud presentada (expediente ${op.ref.trim()})`) }, 'Registró la solicitud de certificación MPI', 'MPI')
    }

    case 'constancia': {
      const blockers = constanciaBlockers(mpi)
      if (blockers.length > 0) return err(blockers[0] ?? '')
      const bad = Object.values(validateRefAndDate(s, op, mpi.requestedAt))[0]
      if (bad) return err(bad)
      const next: Mpi = { ...mpi, status: 'Vigente', constanciaAt: op.date, constanciaRef: op.ref.trim() }
      return set({ ...next, history: note(s, `Constancia vigente registrada; vence el ${formatDate(mpiExpiry(next) ?? '')}`) }, 'Registró la constancia de certificación MPI', 'MPI')
    }
  }
}
