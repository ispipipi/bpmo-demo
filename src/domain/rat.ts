import { formatDate } from '../lib/dates'
import { daysLeft, ratRequestDue } from './derive/sla'
import { nextId } from './ids'
import { withLog } from './log'
import { err, ok, type Result } from './result'
import {
  APPROVERS,
  type ActivityDraft,
  type Approval,
  type Approver,
  type DemoState,
  type RatActivity,
  type RatRequest,
  type RatRequestType,
} from './types'

export const AREAS = ['Atención a clientes', 'Compras', 'Finanzas', 'Legal', 'Marketing', 'Operaciones', 'Recursos Humanos', 'Tecnología'] as const
export const LEGAL_BASES = ['Consentimiento', 'Ejecución de contrato', 'Obligación legal', 'Interés legítimo', 'Medidas precontractuales'] as const
export const MIN_TEXT = 10
const ACTOR = 'Analista PMO'

export type RatOp =
  | { kind: 'create'; input: NewRequestInput }
  | { kind: 'start'; id: string }
  | { kind: 'approval'; id: string; approver: Approver; result: 'Aprobado' | 'Observado'; date: string; ref: string; comment: string }
  | { kind: 'return'; id: string }
  | { kind: 'resubmit'; id: string }
  | { kind: 'reject'; id: string; reason: string }
  | { kind: 'register'; id: string }
  | { kind: 'review' }

export type NewRequestInput = {
  type: RatRequestType
  activityId: string | null
  requester: string
  description: string
  proposal: ActivityDraft | null
}

export type RequestField = 'activityId' | 'requester' | 'description' | 'name' | 'purpose' | 'legalBasis' | 'dataCategories' | 'holders' | 'proposal'
export type FieldErrors = Partial<Record<RequestField, string>>

export const draftOf = (a: RatActivity): ActivityDraft => ({
  name: a.name,
  area: a.area,
  purpose: a.purpose,
  legalBasis: a.legalBasis,
  dataCategories: a.dataCategories,
  holders: a.holders,
  international: a.international,
})

const DRAFT_FIELDS: readonly (keyof ActivityDraft)[] = ['name', 'area', 'purpose', 'legalBasis', 'dataCategories', 'holders', 'international']
const sameDraft = (a: ActivityDraft, b: ActivityDraft) => DRAFT_FIELDS.every((k) => (typeof a[k] === 'string' ? (a[k] as string).trim() === (b[k] as string).trim() : a[k] === b[k]))

/** Consentimientos que dependen de una actividad: bloquean su eliminación (AC-07). */
export const consentsOf = (s: DemoState, activityId: string) => s.data.consents.filter((c) => c.activityId === activityId)

export const OPEN_STATUSES = ['Recibida', 'En validación', 'Observada', 'Aprobada'] as const
const UNDER_REVIEW = ['En validación', 'Observada', 'Aprobada'] as const

export const requestsOnActivity = (s: DemoState, activityId: string, exceptId?: string): RatRequest[] =>
  s.data.rat.requests.filter((r) => r.activityId === activityId && r.id !== exceptId && (OPEN_STATUSES as readonly string[]).includes(r.status))

export const activityStatus = (s: DemoState, activityId: string): 'Vigente' | 'En revisión' =>
  s.data.rat.requests.some((r) => r.activityId === activityId && (UNDER_REVIEW as readonly string[]).includes(r.status)) ? 'En revisión' : 'Vigente'

export function validateNewRequest(s: DemoState, i: NewRequestInput): FieldErrors {
  const e: FieldErrors = {}
  if (!(AREAS as readonly string[]).includes(i.requester)) e.requester = 'Elige el área solicitante.'
  const activity = i.activityId ? s.data.rat.activities.find((a) => a.id === i.activityId) : undefined
  if (i.type !== 'Crear' && !activity) e.activityId = 'Elige una actividad existente del RAT.'
  if (i.description.trim().length < MIN_TEXT) e.description = `Describe la solicitud en al menos ${MIN_TEXT} caracteres.`
  if (i.type === 'Eliminar' && activity) {
    const blocking = consentsOf(s, activity.id)
    if (blocking.length > 0) e.activityId = `No se puede eliminar: la actividad tiene consentimientos asociados (${blocking.map((c) => c.purpose).join(', ')}). Gestiónalos primero.`
  }
  if (i.type !== 'Eliminar') {
    const p = i.proposal
    if (!p || p.name.trim() === '') e.name = 'Indica el nombre de la actividad.'
    if (!p || p.purpose.trim() === '') e.purpose = 'Indica la finalidad.'
    if (!p || !(LEGAL_BASES as readonly string[]).includes(p.legalBasis)) e.legalBasis = 'Elige la base de licitud.'
    if (!p || p.dataCategories.trim() === '') e.dataCategories = 'Indica las categorías de datos.'
    if (!p || p.holders.trim() === '') e.holders = 'Indica los titulares.'
    if (i.type === 'Modificar' && p && activity && Object.keys(e).length === 0 && sameDraft(p, draftOf(activity))) {
      e.proposal = 'La solicitud no tiene cambios respecto del registro actual.'
    }
  }
  return e
}

export type RequestWarning = { kind: 'misma-actividad' | 'transferencia-internacional'; text: string }

/** Avisos que no bloquean (MD §6.4 casos borde). */
export function requestWarnings(s: DemoState, i: Pick<NewRequestInput, 'activityId' | 'proposal'>, exceptId?: string): RequestWarning[] {
  const out: RequestWarning[] = []
  const activity = i.activityId ? s.data.rat.activities.find((a) => a.id === i.activityId) : undefined
  if (i.activityId) {
    const others = requestsOnActivity(s, i.activityId, exceptId)
    if (others.length > 0) out.push({ kind: 'misma-actividad', text: `Ya hay ${others.length === 1 ? 'otra solicitud abierta' : `${others.length} solicitudes abiertas`} sobre esta actividad (${others.map((r) => r.id).join(', ')}).` })
  }
  if (activity?.international || i.proposal?.international) {
    out.push({ kind: 'transferencia-internacional', text: 'Esta actividad tiene transferencia internacional. Revisa el proveedor asociado en Proveedores y transferencias.' })
  }
  return out
}

export type ApprovalSummary = { approved: number; observed: number; missing: Approver[] }
export function approvalSummary(r: RatRequest): ApprovalSummary {
  const states = APPROVERS.map((a) => [a, r.approvals[a].state] as const)
  return {
    approved: states.filter(([, st]) => st === 'Aprobado').length,
    observed: states.filter(([, st]) => st === 'Observado').length,
    missing: states.filter(([, st]) => st !== 'Aprobado').map(([a]) => a),
  }
}

/** Qué falta para registrar en el RAT (AC-06). Vacío = se puede registrar. */
export function registerBlockers(s: DemoState, r: RatRequest): string[] {
  const out: string[] = []
  const sum = approvalSummary(r)
  if (r.status === 'Recibida') out.push('Inicia la validación para registrar los vistos buenos.')
  else if (r.status === 'Observada') out.push('La solicitud fue devuelta con observaciones: reingrésala corregida para reiniciar la validación.')
  else if (sum.approved < APPROVERS.length) out.push(`Faltan ${APPROVERS.length - sum.approved} de ${APPROVERS.length} vistos buenos: ${sum.missing.join(' y ')}.`)
  if (r.type === 'Eliminar' && r.activityId) {
    const c = consentsOf(s, r.activityId)
    if (c.length > 0) out.push(`La actividad tiene consentimientos asociados (${c.map((x) => x.purpose).join(', ')}); gestiónalos antes de eliminarla.`)
  }
  return out
}

export const validateApproval = (s: DemoState, o: { result: string; date: string; ref: string; comment: string }): Partial<Record<'date' | 'ref' | 'comment', string>> => {
  const e: Partial<Record<'date' | 'ref' | 'comment', string>> = {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date)) e.date = 'Ingresa una fecha válida.'
  else if (o.date > s.clock) e.date = 'La fecha no puede ser posterior a la fecha de demo.'
  if (o.ref.trim() === '') e.ref = 'Indica la referencia del documento.'
  if (o.result === 'Observado' && o.comment.trim() === '') e.comment = 'El comentario es obligatorio si el resultado es Observado.'
  return e
}
export const validateRejectReason = (t: string): string | null => (t.trim().length >= MIN_TEXT ? null : `El motivo debe tener al menos ${MIN_TEXT} caracteres.`)

const emptyApprovals = (): Record<Approver, Approval> =>
  Object.fromEntries(APPROVERS.map((a) => [a, { state: 'Pendiente', date: null, ref: null, comment: null }])) as Record<Approver, Approval>

const note = (s: DemoState, r: RatRequest, text: string): RatRequest => ({ ...r, history: [...r.history, { date: s.clock, actor: ACTOR, text }] })

function setRequests(s: DemoState, requests: RatRequest[], log: string, entity: string): DemoState {
  return withLog({ ...s, data: { ...s.data, rat: { ...s.data.rat, requests } } }, log, entity)
}

function editRequest(s: DemoState, id: string, change: (r: RatRequest) => RatRequest | string, log: string): Result<DemoState, string> {
  const r = s.data.rat.requests.find((x) => x.id === id)
  if (!r) return err(`No existe la solicitud ${id}.`)
  const next = change(r)
  if (typeof next === 'string') return err(next)
  return ok(setRequests(s, s.data.rat.requests.map((x) => (x.id === id ? next : x)), log, id))
}

const isOpenReq = (r: RatRequest) => (OPEN_STATUSES as readonly string[]).includes(r.status)
const CLOSED = 'La solicitud ya está cerrada.'

function register(s: DemoState, r: RatRequest): Result<DemoState, string> {
  const blockers = registerBlockers(s, r)
  if (r.status !== 'Aprobada' && r.status !== 'En validación') return err(blockers[0] ?? CLOSED)
  if (blockers.length > 0) return err(blockers.join(' '))
  const rat = s.data.rat
  const version = rat.version + 1
  let activities = rat.activities
  let text: string
  if (r.type === 'Crear' && r.proposal) {
    const id = nextId('ACT', activities.map((a) => a.id), 2)
    activities = [...activities, { ...r.proposal, id, history: [{ date: s.clock, actor: ACTOR, text: `Actividad creada por ${r.id}, RAT versión ${version}` }] }]
    text = `Creó la actividad ${id} (${r.proposal.name})`
  } else if (r.type === 'Modificar' && r.proposal && r.activityId) {
    activities = activities.map((a) => (a.id === r.activityId ? { ...a, ...r.proposal, history: [...a.history, { date: s.clock, actor: ACTOR, text: `Modificada por ${r.id}, RAT versión ${version}` }] } : a))
    text = `Modificó la actividad ${r.activityId}`
  } else if (r.type === 'Eliminar' && r.activityId) {
    activities = activities.filter((a) => a.id !== r.activityId)
    text = `Eliminó la actividad ${r.activityId}`
  } else return err('La solicitud no tiene contenido para registrar.')
  const createdId = r.type === 'Crear' ? activities.at(-1)?.id ?? null : r.activityId
  const requests = rat.requests.map((x) => (x.id === r.id ? note(s, { ...x, activityId: createdId, status: 'Registrada' }, `Registrada en el RAT, versión ${version} (simulado)`) : x))
  return ok(withLog({ ...s, data: { ...s.data, rat: { ...rat, version, updatedAt: s.clock, reviewedAt: s.clock, activities, requests } } }, `${text}; RAT versión ${version} (simulado)`, r.id))
}

export function applyRatOp(s: DemoState, op: RatOp): Result<DemoState, string> {
  switch (op.kind) {
    case 'create': {
      const errors = validateNewRequest(s, op.input)
      const first = Object.values(errors)[0]
      if (first) return err(first)
      const id = nextId('RAT-S', s.data.rat.requests.map((r) => r.id), 3)
      const i = op.input
      const request: RatRequest = {
        id,
        type: i.type,
        activityId: i.type === 'Crear' ? null : i.activityId,
        requester: i.requester,
        description: i.description.trim(),
        proposal: i.type === 'Eliminar' ? null : i.proposal,
        receivedAt: s.clock,
        status: 'Recibida',
        approvals: emptyApprovals(),
        history: [{ date: s.clock, actor: ACTOR, text: `Solicitud de ${i.type.toLowerCase()} registrada para ${i.requester}` }],
      }
      return ok(setRequests(s, [...s.data.rat.requests, request], `Registró la solicitud ${id}`, id))
    }

    case 'start':
      return editRequest(s, op.id, (r) => (r.status === 'Recibida' ? note(s, { ...r, status: 'En validación' }, 'Validación iniciada') : 'Solo se puede iniciar la validación de una solicitud recibida.'), 'Inició la validación')

    case 'approval':
      return editRequest(
        s,
        op.id,
        (r) => {
          if (r.status !== 'En validación') return 'Los vistos buenos se registran con la solicitud en validación.'
          if (r.approvals[op.approver].state === 'Aprobado') return `${op.approver} ya aprobó esta solicitud.`
          const bad = Object.values(validateApproval(s, op))[0]
          if (bad) return bad
          const approval: Approval = { state: op.result, date: op.date, ref: op.ref.trim(), comment: op.comment.trim() || null }
          const withApproval: RatRequest = { ...r, approvals: { ...r.approvals, [op.approver]: approval } }
          const all = approvalSummary(withApproval).approved === APPROVERS.length
          const next = all ? { ...withApproval, status: 'Aprobada' as const } : withApproval
          return note(s, next, `Visto bueno de ${op.approver}: ${op.result}${approval.comment ? ` (${approval.comment})` : ''}${all ? '. Solicitud aprobada con 5 de 5 vistos buenos' : ''}`)
        },
        `Registró visto bueno (${op.approver}: ${op.result})`,
      )

    case 'return':
      return editRequest(
        s,
        op.id,
        (r) => {
          if (r.status !== 'En validación') return 'Solo se devuelve una solicitud que está en validación.'
          const observed = APPROVERS.filter((a) => r.approvals[a].state === 'Observado')
          if (observed.length === 0) return 'No hay vistos buenos observados para devolver.'
          const motive = observed.map((a) => `${a}: ${r.approvals[a].comment ?? 'sin comentario'}`).join('; ')
          return note(s, { ...r, status: 'Observada' }, `Devuelta con observaciones. ${motive}`)
        },
        'Devolvió con observaciones',
      )

    case 'resubmit':
      return editRequest(
        s,
        op.id,
        (r) => (r.status === 'Observada' ? note(s, { ...r, status: 'En validación', approvals: emptyApprovals() }, 'Reingresada corregida: vistos buenos reiniciados') : 'Solo se reingresa una solicitud observada.'),
        'Reingresó la solicitud',
      )

    case 'reject':
      return editRequest(
        s,
        op.id,
        (r) => {
          if (r.status !== 'En validación') return 'Solo se rechaza una solicitud que está en validación.'
          const bad = validateRejectReason(op.reason)
          if (bad) return bad
          return note(s, { ...r, status: 'Rechazada' }, `Solicitud rechazada: ${op.reason.trim()}. Sin cambios en el RAT`)
        },
        'Rechazó la solicitud',
      )

    case 'register': {
      const r = s.data.rat.requests.find((x) => x.id === op.id)
      if (!r) return err(`No existe la solicitud ${op.id}.`)
      if (!isOpenReq(r)) return err(CLOSED)
      return register(s, r)
    }

    case 'review': {
      const rat = { ...s.data.rat, reviewedAt: s.clock }
      return ok(withLog({ ...s, data: { ...s.data, rat } }, `Registró la revisión mensual del RAT (${formatDate(s.clock)}); la versión no cambia`, 'RAT'))
    }
  }
}

export type RatRequestView = {
  req: RatRequest
  due: string
  open: boolean
  daysLeft: number | null
  tone: 'ok' | 'warn' | 'crit' | null
  summary: ApprovalSummary
}

export function ratRequestView(r: RatRequest, s: DemoState): RatRequestView {
  const due = ratRequestDue(r, s.params)
  const open = isOpenReq(r)
  const left = daysLeft(due, s.clock)
  const tone = !open ? null : left < 0 ? 'crit' : left <= s.params.dueSoonDays ? 'warn' : 'ok'
  return { req: r, due, open, daysLeft: open ? left : null, tone, summary: approvalSummary(r) }
}

const TONE_ORDER = { crit: 0, warn: 1, ok: 2 } as const
export function ratRequestViews(s: DemoState): RatRequestView[] {
  return s.data.rat.requests
    .map((r) => ratRequestView(r, s))
    .sort((a, b) => Number(b.open) - Number(a.open) || (a.tone && b.tone ? TONE_ORDER[a.tone] - TONE_ORDER[b.tone] : 0) || (a.daysLeft ?? 0) - (b.daysLeft ?? 0) || a.req.id.localeCompare(b.req.id))
}
