import { formatDate } from '../lib/dates'
import { arcopClosedInTime, arcopDue } from './derive/sla'
import { withLog } from './log'
import { err, ok, type Result } from './result'
import type { ArcopRequest, ArcopType, DemoState, SubtaskState } from './types'

export const ANALYSTS = ['Analista Demo 1', 'Analista Demo 2', 'Analista Demo 3'] as const
export const MIN_EXTENSION_REASON = 10
export const MIN_REJECTION_GROUND = 20
const ACTOR = 'Analista PMO'

export type ArcopOp =
  | { kind: 'assign'; id: string; analyst: string }
  | { kind: 'subtask'; id: string; subtaskId: string; state: SubtaskState; evidenceRef?: string }
  | { kind: 'reminder'; id: string; subtaskId: string }
  | { kind: 'extension'; id: string; reason: string }
  | { kind: 'response'; id: string; text: string }
  | { kind: 'close'; id: string }
  | { kind: 'reject'; id: string; ground: string }

export const isOpen = (r: ArcopRequest): boolean => r.status !== 'Cerrada'
const allSubtasksDone = (r: ArcopRequest): boolean => r.subtasks.every((t) => t.state === 'Completa')

/** Respuesta lista solo con todas las subtareas completas y la respuesta redactada (MD §6.3). */
function reconcile(r: ArcopRequest): ArcopRequest {
  if (r.status !== 'En gestión' && r.status !== 'Respuesta lista') return r
  const ready = allSubtasksDone(r) && r.response.trim() !== ''
  return { ...r, status: ready ? 'Respuesta lista' : 'En gestión' }
}

/** Qué falta para cerrar (MD §6.3, AC-05). Vacío = se puede cerrar. */
export function closeBlockers(r: ArcopRequest): string[] {
  const out: string[] = []
  const pending = r.subtasks.filter((t) => t.state !== 'Completa')
  if (pending.length > 0) out.push(`Faltan ${pending.length} de ${r.subtasks.length} subtareas por completar.`)
  if (r.response.trim() === '') out.push('Falta redactar la respuesta.')
  if (out.length === 0 && r.status !== 'Respuesta lista') out.push('El caso aún no está en estado "Respuesta lista".')
  return out
}

export const validateExtensionReason = (reason: string): string | null =>
  reason.trim().length >= MIN_EXTENSION_REASON ? null : `El motivo debe tener al menos ${MIN_EXTENSION_REASON} caracteres.`
export const validateRejectionGround = (ground: string): string | null =>
  ground.trim().length >= MIN_REJECTION_GROUND ? null : `El fundamento debe tener al menos ${MIN_REJECTION_GROUND} caracteres.`
export const validateResponse = (text: string): string | null => (text.trim() === '' ? 'La respuesta no puede estar vacía.' : null)

/** Posible duplicado: mismo titular y tipo en otro caso. Avisa, no bloquea (MD §6.3). */
export function possibleDuplicate(s: DemoState, r: ArcopRequest): ArcopRequest | undefined {
  return s.data.arcop.find((x) => x.id !== r.id && x.holder === r.holder && x.type === r.type)
}

export function responseTemplate(type: ArcopType, holder: string): string {
  const head = `Estimado/a ${holder}:\n\nEn respuesta a su solicitud de ${type.toLowerCase()} de datos personales, le informamos que `
  const body: Record<ArcopType, string> = {
    Acceso: 'adjuntamos copia de los datos personales que Sanitor trata sobre usted, junto con las finalidades del tratamiento y los destinatarios.',
    Rectificación: 'hemos rectificado los datos personales indicados en su solicitud y actualizado nuestros registros.',
    Supresión: 'hemos suprimido los datos personales indicados en su solicitud, salvo aquellos que debemos conservar por obligación legal.',
    Oposición: 'hemos dejado de tratar sus datos personales para la finalidad a la que usted se opuso.',
    Portabilidad: 'adjuntamos sus datos personales en un formato estructurado, de uso común y lectura mecánica.',
  }
  return `${head}${body[type]}\n\nSaludos cordiales,\nEquipo de protección de datos de Sanitor`
}

type Edit = (r: ArcopRequest) => ArcopRequest | string

function edit(s: DemoState, id: string, change: Edit, log: string): Result<DemoState, string> {
  const r = s.data.arcop.find((x) => x.id === id)
  if (!r) return err(`No existe la solicitud ${id}.`)
  const next = change(r)
  if (typeof next === 'string') return err(next)
  const arcop = s.data.arcop.map((x) => (x.id === id ? next : x))
  return ok(withLog({ ...s, data: { ...s.data, arcop } }, log, id))
}

const note = (s: DemoState, r: ArcopRequest, text: string): ArcopRequest => ({ ...r, history: [...r.history, { date: s.clock, actor: ACTOR, text }] })
const CLOSED = 'El caso ya está cerrado.'

export function applyArcopOp(s: DemoState, op: ArcopOp): Result<DemoState, string> {
  switch (op.kind) {
    case 'assign':
      return edit(
        s,
        op.id,
        (r) => {
          if (!isOpen(r)) return CLOSED
          if (!(ANALYSTS as readonly string[]).includes(op.analyst)) return 'Elige un analista de la lista.'
          if (r.analyst === op.analyst) return `El caso ya está asignado a ${op.analyst}.`
          const text = r.analyst ? `Caso reasignado de ${r.analyst} a ${op.analyst}` : `Caso asignado a ${op.analyst}`
          return note(s, { ...r, analyst: op.analyst, status: r.status === 'Nueva' ? 'En gestión' : r.status }, text)
        },
        `Asignó ${op.analyst}`,
      )

    case 'subtask':
      return edit(
        s,
        op.id,
        (r) => {
          if (!isOpen(r)) return CLOSED
          const t = r.subtasks.find((x) => x.id === op.subtaskId)
          if (!t) return 'No existe la subtarea.'
          if (t.state === op.state) return 'La subtarea ya está en ese estado.'
          const ref = op.evidenceRef?.trim() || null
          const subtasks = r.subtasks.map((x) =>
            x.id !== t.id ? x : { ...x, state: op.state, date: op.state === 'Completa' ? s.clock : null, evidenceRef: op.state === 'Completa' ? ref : null },
          )
          const base: ArcopRequest = { ...r, subtasks, status: r.status === 'Nueva' ? 'En gestión' : r.status }
          return note(s, reconcile(base), `Subtarea "${t.name}": ${t.state} → ${op.state}${ref ? ` (evidencia ${ref})` : ''}`)
        },
        `Subtarea → ${op.state}`,
      )

    case 'reminder':
      return edit(
        s,
        op.id,
        (r) => {
          if (!isOpen(r)) return CLOSED
          const t = r.subtasks.find((x) => x.id === op.subtaskId)
          if (!t) return 'No existe la subtarea.'
          if (!t.external || t.state === 'Completa') return 'Solo se envían recordatorios por subtareas pendientes de un área de Sanitor.'
          return note(s, r, `Recordatorio simulado enviado a ${t.responsible} por "${t.name}"`)
        },
        'Recordatorio simulado',
      )

    case 'extension':
      return edit(
        s,
        op.id,
        (r) => {
          if (!isOpen(r)) return CLOSED
          if (r.extension) return 'Este caso ya tiene una prórroga; no admite una segunda.'
          const bad = validateExtensionReason(op.reason)
          if (bad) return bad
          const next: ArcopRequest = { ...r, extension: { reason: op.reason.trim(), date: s.clock, days: s.params.arcopExtensionDays } }
          return note(s, next, `Prórroga registrada: +${s.params.arcopExtensionDays} días, nuevo vencimiento ${formatDate(arcopDue(next, s.params))}`)
        },
        'Registró prórroga',
      )

    case 'response':
      return edit(
        s,
        op.id,
        (r) => {
          if (!isOpen(r)) return CLOSED
          if (r.status === 'Nueva') return 'Asigna un analista o inicia una subtarea antes de preparar la respuesta.'
          const bad = validateResponse(op.text)
          if (bad) return bad
          return note(s, reconcile({ ...r, response: op.text.trimEnd() }), 'Respuesta al titular guardada')
        },
        'Guardó la respuesta',
      )

    case 'close':
      return edit(
        s,
        op.id,
        (r) => {
          const blockers = closeBlockers(r)
          if (!isOpen(r)) return CLOSED
          if (blockers.length > 0) return blockers.join(' ')
          const closed: ArcopRequest = { ...r, status: 'Cerrada', resolution: 'Respondida', closedAt: s.clock }
          const inTime = arcopClosedInTime(closed, s.params)
          return note(s, closed, `Caso cerrado ${inTime ? 'dentro de plazo' : 'fuera de plazo'}`)
        },
        'Cerró el caso',
      )

    case 'reject':
      return edit(
        s,
        op.id,
        (r) => {
          if (!isOpen(r)) return CLOSED
          const bad = validateRejectionGround(op.ground)
          if (bad) return bad
          const closed: ArcopRequest = { ...r, status: 'Cerrada', resolution: 'Improcedente', closedAt: s.clock, rejectionGround: op.ground.trim() }
          return note(s, closed, `Caso cerrado como improcedente: ${op.ground.trim()}`)
        },
        'Cerró como improcedente',
      )
  }
}
