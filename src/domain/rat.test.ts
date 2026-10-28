import { describe, expect, it } from 'vitest'
import { D0 } from '../config'
import { addDays } from '../lib/dates'
import { allAlerts } from './derive/alerts'
import { ratRequestTone, ratReviewTone } from './derive/sla'
import { applyNextEvent } from './events'
import {
  activityStatus,
  applyRatOp,
  approvalSummary,
  draftOf,
  registerBlockers,
  requestWarnings,
  ratRequestView,
  validateNewRequest,
  type NewRequestInput,
  type RatOp,
} from './rat'
import { createInitialState } from './seed'
import { APPROVERS, type Approver, type DemoState, type RatRequest } from './types'
import { isDemoState } from '../store/persistence'

const d = (n: number) => addDays(D0, n)
const run = (s: DemoState, op: RatOp): DemoState => {
  const r = applyRatOp(s, op)
  if (!r.ok) throw new Error(r.error)
  return r.value
}
const fail = (s: DemoState, op: RatOp): string => {
  const r = applyRatOp(s, op)
  if (r.ok) throw new Error('debía fallar')
  return r.error
}
const req = (s: DemoState, id: string): RatRequest => {
  const r = s.data.rat.requests.find((x) => x.id === id)
  if (!r) throw new Error(id)
  return r
}
const act = (s: DemoState, id: string) => s.data.rat.activities.find((a) => a.id === id)
const approve = (s: DemoState, id: string, who: readonly Approver[]): DemoState =>
  who.reduce((acc, approver) => run(acc, { kind: 'approval', id, approver, result: 'Aprobado', date: acc.clock, ref: `VB-${approver.slice(0, 2)}` , comment: '' }), s)
const after = (n: number) => {
  let s = createInitialState()
  for (let i = 0; i < n; i++) s = applyNextEvent(s).state
  return s
}

const modifyInput = (s: DemoState, over: Partial<NewRequestInput['proposal'] & object> = {}): NewRequestInput => {
  const a = act(s, 'ACT-12')!
  return { type: 'Modificar', activityId: a.id, requester: 'Compras', description: 'Ampliar las categorías de datos del registro.', proposal: { ...draftOf(a), dataCategories: `${a.dataCategories}, cargo`, ...over } }
}
const createInput: NewRequestInput = {
  type: 'Crear',
  activityId: null,
  requester: 'Marketing',
  description: 'Registrar la actividad de concursos y sorteos.',
  proposal: { name: 'Concursos y sorteos', area: 'Marketing', purpose: 'Realizar sorteos promocionales', legalBasis: 'Consentimiento', dataCategories: 'Nombre, correo', holders: 'Participantes', international: false },
}

describe('registrar nueva solicitud (MD §6.4)', () => {
  it('Crear: crea la solicitud Recibida con 5 vistos buenos pendientes y plazo interno', () => {
    const s = run(createInitialState(), { kind: 'create', input: createInput })
    const r = req(s, 'RAT-S-004')
    expect(r).toMatchObject({ type: 'Crear', activityId: null, status: 'Recibida', receivedAt: D0, requester: 'Marketing' })
    expect(APPROVERS.every((a) => r.approvals[a].state === 'Pendiente')).toBe(true)
    expect(ratRequestView(r, s)).toMatchObject({ due: d(15), tone: 'ok', daysLeft: 15 })
    expect(s.log.at(-1)).toMatchObject({ entity: 'RAT-S-004' })
  })

  it('Crear exige todos los campos de la actividad y descripción de al menos 10 caracteres', () => {
    const s = createInitialState()
    const e = validateNewRequest(s, { ...createInput, description: 'corta', proposal: { ...createInput.proposal!, name: ' ', purpose: '', legalBasis: 'x', dataCategories: '', holders: '' } })
    expect(Object.keys(e).sort()).toEqual(['dataCategories', 'description', 'holders', 'legalBasis', 'name', 'purpose'])
    expect(validateNewRequest(s, { ...createInput, requester: '' }).requester).toBeDefined()
    expect(validateNewRequest(s, createInput)).toEqual({})
  })

  it('Modificar y Eliminar exigen elegir una actividad existente', () => {
    const s = createInitialState()
    expect(validateNewRequest(s, { ...createInput, type: 'Modificar' }).activityId).toBeDefined()
    expect(validateNewRequest(s, { ...modifyInput(s), activityId: 'ACT-99' }).activityId).toBeDefined()
    expect(validateNewRequest(s, { type: 'Eliminar', activityId: null, requester: 'Compras', description: 'Ya no se realiza esta actividad.', proposal: null }).activityId).toBeDefined()
  })

  it('Modificar sin cambios respecto del registro actual es un error en línea', () => {
    const s = createInitialState()
    const a = act(s, 'ACT-12')!
    expect(validateNewRequest(s, { ...modifyInput(s), proposal: draftOf(a) }).proposal).toBe('La solicitud no tiene cambios respecto del registro actual.')
    expect(validateNewRequest(s, modifyInput(s))).toEqual({})
    expect(validateNewRequest(s, modifyInput(s, { international: true }))).toEqual({})
  })

  it('Eliminar una actividad con consentimientos asociados se bloquea y los lista (AC-07)', () => {
    const s = createInitialState()
    const input: NewRequestInput = { type: 'Eliminar', activityId: 'ACT-03', requester: 'Marketing', description: 'Se dejará de enviar el newsletter.', proposal: null }
    expect(validateNewRequest(s, input).activityId).toContain('Newsletter')
    expect(fail(s, { kind: 'create', input })).toContain('consentimientos asociados')
    expect(applyRatOp(s, { kind: 'create', input: { ...input, activityId: 'ACT-12' } }).ok).toBe(true)
  })

  it('avisa sin bloquear: otra solicitud abierta sobre la misma actividad y transferencia internacional', () => {
    const s = createInitialState()
    const same = requestWarnings(s, { activityId: 'ACT-05', proposal: null })
    expect(same.map((w) => w.kind)).toEqual(['misma-actividad'])
    expect(same[0]?.text).toContain('RAT-S-001')
    expect(requestWarnings(s, { activityId: 'ACT-03', proposal: null }).map((w) => w.kind)).toEqual(['transferencia-internacional'])
    expect(requestWarnings(s, { activityId: 'ACT-12', proposal: null })).toEqual([])
  })
})

describe('vistos buenos y flujo de estados', () => {
  it('Iniciar validación pasa Recibida → En validación, solo una vez', () => {
    const s = run(createInitialState(), { kind: 'start', id: 'RAT-S-002' })
    expect(req(s, 'RAT-S-002').status).toBe('En validación')
    expect(fail(s, { kind: 'start', id: 'RAT-S-002' })).toContain('Solo se puede iniciar')
  })

  it('registra un visto bueno con fecha y referencia; actualiza el contador (3 → 4 de 5)', () => {
    const s = approve(createInitialState(), 'RAT-S-001', ['DPD'])
    expect(req(s, 'RAT-S-001').approvals.DPD).toMatchObject({ state: 'Aprobado', date: D0, ref: 'VB-DP' })
    expect(approvalSummary(req(s, 'RAT-S-001'))).toMatchObject({ approved: 4, missing: ['Compliance'] })
  })

  it('valida fecha, referencia y comentario obligatorio si es Observado', () => {
    const s = createInitialState()
    const base = { kind: 'approval' as const, id: 'RAT-S-001', approver: 'DPD' as Approver, result: 'Aprobado' as const, date: D0, ref: 'VB-1', comment: '' }
    expect(fail(s, { ...base, ref: '  ' })).toContain('referencia')
    expect(fail(s, { ...base, date: d(1) })).toContain('posterior a la fecha de demo')
    expect(fail(s, { ...base, date: 'ayer' })).toContain('fecha válida')
    expect(fail(s, { ...base, result: 'Observado' })).toContain('comentario')
    expect(applyRatOp(s, { ...base, result: 'Observado', comment: 'Falta indicar el plazo de conservación.' }).ok).toBe(true)
  })

  it('no admite visto bueno fuera de validación ni repetir un aprobado', () => {
    const s = createInitialState()
    expect(fail(s, { kind: 'approval', id: 'RAT-S-002', approver: 'Legal', result: 'Aprobado', date: D0, ref: 'VB', comment: '' })).toContain('en validación')
    expect(fail(s, { kind: 'approval', id: 'RAT-S-001', approver: 'Legal', result: 'Aprobado', date: D0, ref: 'VB', comment: '' })).toContain('ya aprobó')
  })

  it('con 5 de 5 la solicitud pasa a Aprobada', () => {
    const s = approve(createInitialState(), 'RAT-S-001', ['DPD', 'Compliance'])
    expect(req(s, 'RAT-S-001').status).toBe('Aprobada')
    expect(req(s, 'RAT-S-001').history.at(-1)?.text).toContain('5 de 5 vistos buenos')
  })

  it('Devolver con observaciones exige un observado; Reingresar reinicia los vistos buenos', () => {
    const s = createInitialState()
    expect(fail(s, { kind: 'return', id: 'RAT-S-001' })).toContain('No hay vistos buenos observados')
    const observed = run(s, { kind: 'approval', id: 'RAT-S-001', approver: 'DPD', result: 'Observado', date: D0, ref: 'VB-34', comment: 'Falta el plazo de conservación.' })
    const returned = run(observed, { kind: 'return', id: 'RAT-S-001' })
    expect(req(returned, 'RAT-S-001').status).toBe('Observada')
    expect(req(returned, 'RAT-S-001').history.at(-1)?.text).toContain('DPD: Falta el plazo de conservación.')
    expect(registerBlockers(returned, req(returned, 'RAT-S-001'))[0]).toContain('reingrésala')
    const again = run(returned, { kind: 'resubmit', id: 'RAT-S-001' })
    expect(req(again, 'RAT-S-001').status).toBe('En validación')
    expect(approvalSummary(req(again, 'RAT-S-001')).approved).toBe(0)
  })

  it('Rechazar exige motivo, cierra la solicitud y no cambia el RAT', () => {
    const s = createInitialState()
    expect(fail(s, { kind: 'reject', id: 'RAT-S-001', reason: 'no' })).toContain('al menos 10')
    const next = run(s, { kind: 'reject', id: 'RAT-S-001', reason: 'La finalidad no está justificada.' })
    expect(req(next, 'RAT-S-001').status).toBe('Rechazada')
    expect(next.data.rat.version).toBe(12)
    expect(next.data.rat.activities).toEqual(s.data.rat.activities)
    expect(fail(next, { kind: 'register', id: 'RAT-S-001' })).toBe('La solicitud ya está cerrada.')
  })
})

describe('Registrar en RAT (AC-06)', () => {
  it('bloqueado con 3 de 5 y dice quiénes faltan; el RAT no cambia', () => {
    const s = createInitialState()
    expect(registerBlockers(s, req(s, 'RAT-S-001'))).toEqual(['Faltan 2 de 5 vistos buenos: DPD y Compliance.'])
    expect(fail(s, { kind: 'register', id: 'RAT-S-001' })).toContain('Faltan 2 de 5')
    expect(registerBlockers(s, req(s, 'RAT-S-002'))).toEqual(['Inicia la validación para registrar los vistos buenos.'])
  })

  it('Modificar: aplica la propuesta, sube la versión en 1 y actualiza fechas de actualización y revisión', () => {
    const base = after(3)
    const ready = approve(base, 'RAT-S-001', ['DPD', 'Compliance'])
    const next = run(ready, { kind: 'register', id: 'RAT-S-001' })
    expect(next.data.rat).toMatchObject({ version: 13, updatedAt: base.clock, reviewedAt: base.clock })
    expect(act(next, 'ACT-05')?.dataCategories).toContain('número de WhatsApp')
    expect(req(next, 'RAT-S-001').status).toBe('Registrada')
    expect(req(next, 'RAT-S-001').history.at(-1)?.text).toBe('Registrada en el RAT, versión 13 (simulado)')
    expect(act(next, 'ACT-05')?.history.at(-1)?.text).toContain('RAT versión 13')
    expect(ratReviewTone(next)).toBe('ok')
  })

  it('Crear: agrega la actividad con el siguiente id y sube la versión', () => {
    let s = run(createInitialState(), { kind: 'start', id: 'RAT-S-002' })
    s = approve(s, 'RAT-S-002', APPROVERS)
    const next = run(s, { kind: 'register', id: 'RAT-S-002' })
    expect(next.data.rat.activities).toHaveLength(15)
    expect(act(next, 'ACT-15')?.name).toBe('Evaluaciones de desempeño')
    expect(next.data.rat.version).toBe(13)
  })

  it('Eliminar: quita la actividad; dos registros seguidos suben la versión dos veces', () => {
    let s = run(createInitialState(), { kind: 'create', input: { type: 'Eliminar', activityId: 'ACT-12', requester: 'Compras', description: 'Se externaliza el catastro de proveedores.', proposal: null } })
    s = run(s, { kind: 'start', id: 'RAT-S-004' })
    s = approve(s, 'RAT-S-004', APPROVERS)
    s = run(s, { kind: 'register', id: 'RAT-S-004' })
    expect(act(s, 'ACT-12')).toBeUndefined()
    expect(s.data.rat.activities).toHaveLength(13)
    let t = run(s, { kind: 'start', id: 'RAT-S-002' })
    t = approve(t, 'RAT-S-002', APPROVERS)
    expect(run(t, { kind: 'register', id: 'RAT-S-002' }).data.rat.version).toBe(14)
  })

  it('no elimina una actividad con consentimientos aunque la solicitud ya esté aprobada (AC-07)', () => {
    let s = createInitialState()
    const eliminar: RatRequest = { ...req(s, 'RAT-S-002'), id: 'RAT-S-050', type: 'Eliminar', activityId: 'ACT-03', proposal: null, status: 'En validación' }
    s = { ...s, data: { ...s.data, rat: { ...s.data.rat, requests: [...s.data.rat.requests, eliminar] } } }
    s = approve(s, 'RAT-S-050', APPROVERS)
    expect(registerBlockers(s, req(s, 'RAT-S-050'))[0]).toContain('consentimientos asociados (Newsletter)')
    expect(fail(s, { kind: 'register', id: 'RAT-S-050' })).toContain('Newsletter')
    expect(act(s, 'ACT-03')).toBeDefined()
  })

  it('una solicitud en validación pone la actividad "En revisión"; al registrarse vuelve a "Vigente"', () => {
    const s = createInitialState()
    expect(activityStatus(s, 'ACT-05')).toBe('En revisión')
    expect(activityStatus(s, 'ACT-12')).toBe('Vigente')
    const done = run(approve(s, 'RAT-S-001', ['DPD', 'Compliance']), { kind: 'register', id: 'RAT-S-001' })
    expect(activityStatus(done, 'ACT-05')).toBe('Vigente')
  })
})

describe('revisión mensual (AC-06)', () => {
  it('actualiza solo la fecha de revisión, no la versión, y resuelve la alerta', () => {
    const s = after(7)
    expect(allAlerts(s).some((a) => a.id === 'regla:rat-revision-por-vencer:-')).toBe(true)
    const next = run(s, { kind: 'review' })
    expect(next.data.rat).toMatchObject({ version: 12, updatedAt: d(-5), reviewedAt: d(22) })
    expect(allAlerts(next).some((a) => a.id.startsWith('regla:rat-revision'))).toBe(false)
    expect(ratReviewTone(next)).toBe('ok')
  })

  it('registrarla dos veces el mismo día se acepta y queda en la bitácora', () => {
    const s = run(run(createInitialState(), { kind: 'review' }), { kind: 'review' })
    expect(s.log.filter((l) => l.entity === 'RAT')).toHaveLength(2)
  })
})

describe('semáforo de las solicitudes (§5.3)', () => {
  it('en validación: verde en D0, rojo en D0+16; la creada por E4 es verde', () => {
    const s0 = createInitialState()
    expect(ratRequestTone(req(s0, 'RAT-S-001'), s0)).toBe('ok')
    const s16 = after(4)
    expect(ratRequestView(req(s16, 'RAT-S-001'), s16)).toMatchObject({ tone: 'crit', daysLeft: -4 })
    expect(ratRequestView(req(s16, 'RAT-S-004'), s16)).toMatchObject({ tone: 'ok', due: d(31) })
    expect(req(s16, 'RAT-S-004').proposal?.purpose).toContain('campaña de fidelización')
  })

  it('las cerradas no tienen semáforo', () => {
    const s = createInitialState()
    expect(ratRequestView(req(s, 'RAT-S-003'), s)).toMatchObject({ open: false, tone: null, daysLeft: null })
  })
})

describe('integridad', () => {
  it('las operaciones no mutan el estado de entrada', () => {
    const s = createInitialState()
    const snap = JSON.stringify(s)
    run(s, { kind: 'create', input: createInput })
    approve(s, 'RAT-S-001', ['DPD'])
    expect(JSON.stringify(s)).toBe(snap)
  })

  it('un estado guardado sin la propuesta de las solicitudes se descarta como incompatible', () => {
    const s = createInitialState()
    expect(isDemoState(JSON.parse(JSON.stringify(s)))).toBe(true)
    const old = JSON.parse(JSON.stringify(s))
    delete old.data.rat.requests[0].proposal
    expect(isDemoState(old)).toBe(false)
  })
})
