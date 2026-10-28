import { D0 } from '../config'
import { addDays, formatDate } from '../lib/dates'
import { nextId } from './ids'
import { draftOf } from './rat'
import { newSubtasks } from './templates'
import { arcopDue, arcopTone, daysLeft, isArcopOpen, isRatRequestOpen, ratRequestDue } from './derive/sla'
import { APPROVERS, type Approval, type Approver, type ArcopRequest, type ArcopType, type DemoState, type EventAlert, type Finding, type HistoryEntry, type Vendor } from './types'

export const EVENT_COUNT = 8
export const EVENT_CLOCKS = { E3: addDays(D0, 16), E7: addDays(D0, 22) } as const

export type EventResult = { state: DemoState; message: string; eventId: string | null }

const SOURCE = 'Ley de Datos (simulado)'
const entry = (s: DemoState, text: string): HistoryEntry => ({ date: s.clock, actor: SOURCE, text })

function withAlert(s: DemoState, a: Omit<EventAlert, 'date' | 'status'>): DemoState {
  return { ...s, data: { ...s.data, eventAlerts: [...s.data.eventAlerts, { ...a, date: s.clock, status: 'Nueva' }] } }
}

function newArcop(s: DemoState, type: ArcopType, channel: string): { state: DemoState; id: string } {
  const id = nextId('ARCOP', s.data.arcop.map((r) => r.id), 4)
  const holderNo = String(s.data.arcop.length + 1).padStart(2, '0')
  const req: ArcopRequest = {
    id,
    type,
    holder: `Titular Demo ${holderNo}`,
    channel,
    receivedAt: s.clock,
    status: 'Nueva',
    resolution: null,
    closedAt: null,
    analyst: null,
    subtasks: newSubtasks(id, type),
    extension: null,
    response: '',
    rejectionGround: null,
    history: [entry(s, `Solicitud de ${type} recibida por ${channel.toLowerCase()}`)],
  }
  return { state: { ...s, data: { ...s.data, arcop: [...s.data.arcop, req] } }, id }
}

function arcopEvent(type: ArcopType, channel: string, eventId: string) {
  return (s: DemoState): EventResult => {
    const { state, id } = newArcop(s, type, channel)
    const due = arcopDue(state.data.arcop.at(-1)!, state.params)
    return {
      eventId,
      message: `1 novedad: nueva solicitud ARCOP de ${type} (${id}), vence el ${formatDate(due)}. (simulado)`,
      state: withAlert(state, {
        id: `evento:${eventId}:${id}`,
        severity: 'Informativa',
        message: `Nueva solicitud ${id} de ${type}`,
        module: 'ARCOP',
        to: `/arcop/${id}`,
        entityId: id,
      }),
    }
  }
}

function advanceClock(s: DemoState, to: string): DemoState {
  return to > s.clock ? { ...s, clock: to } : s
}

const E3 = (s: DemoState): EventResult => {
  const state = advanceClock(s, EVENT_CLOCKS.E3)
  const dueSoon = state.data.arcop.filter((r) => isArcopOpen(r) && arcopTone(r, state) === 'warn').length
  const late = state.data.rat.requests.filter((r) => isRatRequestOpen(r) && daysLeft(ratRequestDue(r, state.params), state.clock) < 0).length
  return {
    eventId: 'E3',
    state,
    message: `1 novedad: la fecha de demo avanzó al ${formatDate(state.clock)}. ${dueSoon} caso(s) ARCOP por vencer y ${late} solicitud(es) RAT fuera de plazo. (simulado)`,
  }
}

const E4 = (s: DemoState): EventResult => {
  const id = nextId('RAT-S', s.data.rat.requests.map((r) => r.id), 3)
  const approvals = Object.fromEntries(
    APPROVERS.map((a) => [a, { state: 'Pendiente', date: null, ref: null, comment: null }]),
  ) as Record<Approver, Approval>
  const state: DemoState = {
    ...s,
    data: {
      ...s.data,
      rat: {
        ...s.data.rat,
        requests: [
          ...s.data.rat.requests,
          {
            id,
            type: 'Modificar',
            activityId: 'ACT-03',
            requester: 'Marketing',
            description: 'Agregar la finalidad "campaña de fidelización" a la actividad de newsletter.',
            proposal: ((a) => (a ? { ...draftOf(a), purpose: `${a.purpose}; campaña de fidelización` } : null))(s.data.rat.activities.find((x) => x.id === 'ACT-03')),
            receivedAt: s.clock,
            status: 'Recibida',
            approvals,
            history: [entry(s, 'Solicitud de modificación recibida desde Marketing')],
          },
        ],
      },
    },
  }
  return {
    eventId: 'E4',
    message: `1 novedad: solicitud de modificación del RAT desde Marketing (${id}). (simulado)`,
    state: withAlert(state, {
      id: `evento:E4:${id}`,
      severity: 'Informativa',
      message: `Nueva solicitud de modificación del RAT ${id} desde Marketing`,
      module: 'RAT',
      to: `/rat/solicitud/${id}`,
      entityId: id,
    }),
  }
}

const E5 = (s: DemoState): EventResult => {
  const id = nextId('PRV', s.data.vendors.map((v) => v.id), 3)
  const v: Vendor = {
    id,
    name: 'Proveedor Hosting K',
    category: 'Alojamiento web',
    area: 'Tecnología',
    country: 'España',
    international: true,
    dpa: 'Sin DPA',
    dpaExpiresAt: null,
    contractExpiresAt: addDays(s.clock, 300),
    maturity: 'Sin evaluar',
    maturityAt: null,
    guarantee: null,
    guaranteeRef: null,
    requested: { dpa: false, guarantee: false },
    lastReviewAt: null,
    history: [entry(s, 'Proveedor detectado con transferencia internacional, sin DPA ni mecanismo de garantía')],
  }
  const state: DemoState = { ...s, data: { ...s.data, vendors: [...s.data.vendors, v] } }
  return {
    eventId: 'E5',
    message: `1 novedad: proveedor con transferencia internacional sin DPA ni mecanismo de garantía (${v.name}, España). (simulado)`,
    state: withAlert(state, {
      id: `evento:E5:${id}`,
      severity: 'Alta',
      message: `${v.name} (España): transferencia internacional sin DPA ni mecanismo de garantía`,
      module: 'Proveedores',
      to: `/proveedores?id=${id}`,
      entityId: id,
    }),
  }
}

const E6 = (s: DemoState): EventResult => {
  const QTY = 37
  const consents = s.data.consents.map((c) =>
    c.purpose === 'Newsletter'
      ? {
          ...c,
          active: c.active - QTY,
          revoked: c.revoked + QTY,
          movements: [
            ...c.movements,
            { id: `${c.id}-M${c.movements.length + 1}`, kind: 'Revocación' as const, holder: 'Lote', date: s.clock, quantity: QTY, note: `${QTY} revocaciones, lote` },
          ],
          history: [...c.history, entry(s, `${QTY} revocaciones de consentimiento recibidas`)],
        }
      : c,
  )
  const state: DemoState = { ...s, data: { ...s.data, consents } }
  const target = consents.find((c) => c.purpose === 'Newsletter')
  return {
    eventId: 'E6',
    message: `1 novedad: ${QTY} revocaciones de consentimiento en la lista "Newsletter". (simulado)`,
    state: withAlert(state, {
      id: `evento:E6:${target?.id ?? 'newsletter'}`,
      severity: 'Media',
      message: `${QTY} revocaciones en la lista "Newsletter"`,
      module: 'Consentimientos',
      to: `/consentimientos?id=${target?.id ?? ''}`,
      entityId: target?.id ?? null,
    }),
  }
}

const E7 = (s: DemoState): EventResult => {
  const state = advanceClock(s, EVENT_CLOCKS.E7)
  const breached = state.data.arcop.filter((r) => r.id === 'ARCOP-0003' && isArcopOpen(r) && arcopTone(r, state) === 'crit')
  if (breached.length === 0) {
    return {
      eventId: 'E7',
      state,
      message: `1 novedad: la fecha de demo avanzó al ${formatDate(state.clock)}. Sin incumplimientos nuevos en ARCOP-0003. (simulado)`,
    }
  }
  const arcop = state.data.arcop.map((r) =>
    r.id === 'ARCOP-0003' ? { ...r, history: [...r.history, entry(state, 'SLA incumplido: el caso venció sin respuesta ni prórroga')] } : r,
  )
  return {
    eventId: 'E7',
    message: `1 novedad: la fecha de demo avanzó al ${formatDate(state.clock)}. SLA incumplido en ARCOP-0003; se sugiere evaluar una autodenuncia. (simulado)`,
    state: withAlert(
      { ...state, data: { ...state.data, arcop } },
      {
        id: 'evento:E7:ARCOP-0003',
        severity: 'Crítica',
        message: 'SLA incumplido en ARCOP-0003. Se sugiere abrir una autodenuncia.',
        module: 'ARCOP',
        to: '/arcop/ARCOP-0003',
        entityId: 'ARCOP-0003',
      },
    ),
  }
}

const E8 = (s: DemoState): EventResult => {
  const id = nextId('HAL', s.data.findings.map((f) => f.id), 4)
  const f: Finding = {
    id,
    origin: 'Evento E8',
    originRef: 'E8',
    description: 'Dato personal en una ubicación no declarada en el RAT.',
    detectedAt: s.clock,
    stage: 'Detectado',
    severity: null,
    affectedData: null,
    holdersEstimate: null,
    cause: null,
    plan: [],
    approval: null,
    evaluatedAt: null,
    packageGeneratedAt: null,
    filing: null,
    closedAt: null,
    closeResult: null,
    history: [entry(s, 'Hallazgo detectado: dato personal en una ubicación no declarada en el RAT')],
  }
  return {
    eventId: 'E8',
    message: `1 novedad: hallazgo ${id}, dato personal en una ubicación no declarada en el RAT. (simulado)`,
    state: withAlert(
      { ...s, data: { ...s.data, findings: [...s.data.findings, f] } },
      {
        id: `evento:E8:${id}`,
        severity: 'Media',
        message: `Hallazgo ${id}: dato personal en una ubicación no declarada en el RAT`,
        module: 'MPI y autodenuncia',
        to: `/mpi/hallazgo/${id}`,
        entityId: id,
      },
    ),
  }
}

const EVENTS: readonly ((s: DemoState) => EventResult)[] = [
  arcopEvent('Acceso', 'Formulario web', 'E1'),
  arcopEvent('Supresión', 'Correo electrónico', 'E2'),
  E3,
  E4,
  E5,
  E6,
  E7,
  E8,
]

/** Aplica el siguiente evento guionado (E1…E8, una vez cada uno). Sin eventos: no cambia nada. */
export function applyNextEvent(s: DemoState): EventResult {
  const run = EVENTS[s.nextEvent]
  if (!run) return { state: s, message: 'Sin novedades. Todo al día (simulado)', eventId: null }
  const r = run(s)
  return { ...r, state: { ...r.state, nextEvent: s.nextEvent + 1 } }
}
