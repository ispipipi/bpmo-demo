import { nextId } from './ids'
import { withLog } from './log'
import { err, ok, type Result } from './result'
import type { Agreement, Committee, DemoState, Session } from './types'

export type AgreementStatus = 'Vencido' | 'Pendiente' | 'Cumplido'

/** Vencido = fecha comprometida anterior al reloj y no cumplido; se calcula, no se guarda (MD §6.9). */
export const agreementStatus = (a: Agreement, clock: string): AgreementStatus => (a.status === 'Cumplido' ? 'Cumplido' : a.dueAt < clock ? 'Vencido' : 'Pendiente')

export type CommitteeOp =
  | { kind: 'convene'; sessionId: string; date: string; time: string; place: string; attendees: string }
  | { kind: 'agendaAdd'; sessionId: string; item: string }
  | { kind: 'agendaRemove'; sessionId: string; index: number }
  | { kind: 'agreement'; description: string; owner: string; dueAt: string }
  | { kind: 'followUp'; id: string; text: string }
  | { kind: 'status'; id: string; status: 'Pendiente' | 'Cumplido' }
  | { kind: 'acta'; sessionId: string }

export const nextSessionOf = (c: Committee): Session | undefined => c.sessions.find((x) => x.status === 'Próxima')
export const lastHeldSession = (c: Committee): Session | undefined => [...c.sessions].filter((x) => x.status === 'Realizada').sort((a, b) => b.date.localeCompare(a.date))[0]

export type ConveneErrors = Partial<Record<'date' | 'time' | 'place' | 'attendees', string>>
export function validateConvocation(s: DemoState, c: { date: string; time: string; place: string; attendees: string }): ConveneErrors {
  const e: ConveneErrors = {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date)) e.date = 'Ingresa la fecha de la sesión.'
  else if (c.date < s.clock) e.date = 'La sesión no puede ser anterior a la fecha de demo.'
  if (!/^\d{2}:\d{2}$/.test(c.time)) e.time = 'Ingresa la hora.'
  if (c.place.trim() === '') e.place = 'Indica el lugar o enlace.'
  if (c.attendees.trim() === '') e.attendees = 'Indica los asistentes por área.'
  return e
}

export type AgreementErrors = Partial<Record<'description' | 'owner' | 'dueAt', string>>
export function validateAgreement(a: { description: string; owner: string; dueAt: string }): AgreementErrors {
  const e: AgreementErrors = {}
  if (a.description.trim() === '') e.description = 'Describe el acuerdo.'
  if (a.owner.trim() === '') e.owner = 'Indica el área responsable.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.dueAt)) e.dueAt = 'Indica la fecha comprometida.'
  return e
}
/** Una fecha comprometida ya pasada se permite, pero se avisa (MD §6.9). */
export const dueAlreadyPassed = (dueAt: string, clock: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(dueAt) && dueAt < clock

function setCommittee(s: DemoState, c: Committee, log: string, entity: string): Result<DemoState, string> {
  return ok(withLog({ ...s, data: { ...s.data, committee: c } }, log, entity))
}

export function applyCommitteeOp(s: DemoState, op: CommitteeOp): Result<DemoState, string> {
  const c = s.data.committee
  const mapSession = (id: string, f: (x: Session) => Session) => c.sessions.map((x) => (x.id === id ? f(x) : x))
  const session = 'sessionId' in op ? c.sessions.find((x) => x.id === op.sessionId) : undefined
  if ('sessionId' in op && !session) return err(`No existe la sesión ${op.sessionId}.`)

  switch (op.kind) {
    case 'convene': {
      if (session?.status !== 'Próxima') return err('Solo se convoca la próxima sesión.')
      const bad = Object.values(validateConvocation(s, op))[0]
      if (bad) return err(bad)
      return setCommittee(s, { ...c, sessions: mapSession(op.sessionId, (x) => ({ ...x, date: op.date, convocation: { date: op.date, time: op.time, place: op.place.trim(), attendees: op.attendees.trim() } })) }, 'Registró la convocatoria (simulada)', op.sessionId)
    }
    case 'agendaAdd': {
      if (session?.status !== 'Próxima') return err('Solo se edita la agenda de la próxima sesión.')
      if (op.item.trim() === '') return err('Escribe el punto de la agenda.')
      return setCommittee(s, { ...c, sessions: mapSession(op.sessionId, (x) => ({ ...x, agenda: [...x.agenda, op.item.trim()] })) }, 'Agregó un punto a la agenda', op.sessionId)
    }
    case 'agendaRemove': {
      if (session?.status !== 'Próxima') return err('Solo se edita la agenda de la próxima sesión.')
      if (op.index < 0 || op.index >= session.agenda.length) return err('No existe ese punto de la agenda.')
      return setCommittee(s, { ...c, sessions: mapSession(op.sessionId, (x) => ({ ...x, agenda: x.agenda.filter((_, i) => i !== op.index) })) }, 'Quitó un punto de la agenda', op.sessionId)
    }
    case 'agreement': {
      const bad = Object.values(validateAgreement(op))[0]
      if (bad) return err(bad)
      const held = lastHeldSession(c) ?? nextSessionOf(c)
      if (!held) return err('El comité no tiene sesiones.')
      const id = nextId('ACU', c.agreements.map((a) => a.id), 3)
      const a: Agreement = { id, sessionId: held.id, description: op.description.trim(), owner: op.owner.trim(), dueAt: op.dueAt, status: 'Pendiente', doneAt: null, followUps: [] }
      return setCommittee(s, { ...c, agreements: [...c.agreements, a] }, `Registró el acuerdo ${id}`, id)
    }
    case 'followUp': {
      const a = c.agreements.find((x) => x.id === op.id)
      if (!a) return err(`No existe el acuerdo ${op.id}.`)
      if (op.text.trim().length < 5) return err('El seguimiento debe tener al menos 5 caracteres.')
      return setCommittee(s, { ...c, agreements: c.agreements.map((x) => (x.id === a.id ? { ...x, followUps: [...x.followUps, { date: s.clock, text: op.text.trim() }] } : x)) }, 'Registró un seguimiento', a.id)
    }
    case 'status': {
      const a = c.agreements.find((x) => x.id === op.id)
      if (!a) return err(`No existe el acuerdo ${op.id}.`)
      if (a.status === op.status) return err('El acuerdo ya está en ese estado.')
      return setCommittee(s, { ...c, agreements: c.agreements.map((x) => (x.id === a.id ? { ...x, status: op.status, doneAt: op.status === 'Cumplido' ? s.clock : null } : x)) }, `Marcó el acuerdo como ${op.status}`, a.id)
    }
    case 'acta':
      return ok(withLog(s, `Generó el acta de la sesión del ${session?.date}`, op.sessionId))
  }
}

export type Acta = { session: Session; agreements: { agreement: Agreement; status: AgreementStatus }[]; fulfilled: number; overdue: number }

/** Acta de una sesión: agenda y acuerdos con responsables, cumplidos y vencidos (evidencia del proceso). */
export function buildActa(s: DemoState, sessionId: string): Acta | undefined {
  const session = s.data.committee.sessions.find((x) => x.id === sessionId)
  if (!session) return undefined
  const all = s.data.committee.agreements
  const own = session.status === 'Próxima' ? all.filter((a) => a.status === 'Pendiente' || a.sessionId === session.id) : all.filter((a) => a.sessionId === session.id)
  const agreements = own.map((a) => ({ agreement: a, status: agreementStatus(a, s.clock) }))
  return { session, agreements, fulfilled: agreements.filter((a) => a.status === 'Cumplido').length, overdue: agreements.filter((a) => a.status === 'Vencido').length }
}
