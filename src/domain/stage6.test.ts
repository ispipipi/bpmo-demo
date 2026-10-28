import { describe, expect, it } from 'vitest'
import { D0 } from '../config'
import { addDays } from '../lib/dates'
import { applyAlertOp, reminderTarget, type AlertOp } from './alertOps'
import { agreementStatus, applyCommitteeOp, buildActa, dueAlreadyPassed, validateConvocation, type CommitteeOp } from './committee'
import { applyConsentOp, simulateCampaign, validateListSize, validateRevocation, type ConsentOp } from './consent'
import { allAlerts, newAlerts } from './derive/alerts'
import { dashboardKpis, sidebarData } from './derive/kpis'
import { consentStatus, consentTone, vendorTone } from './derive/sla'
import { processTone } from './derive/tones'
import { applyNextEvent } from './events'
import { DEFAULT_PARAMS, parseParams } from './params'
import { applyProjectOp, BLANK, projectView, validateProject, type ProjectOp } from './projects'
import { createInitialState } from './seed'
import type { DemoState, ScreeningAnswers } from './types'
import { applyVendorOp, forcesInternational, validateGuarantee, vendorStatus, type VendorOp } from './vendors'
import { reducer } from '../store/reducer'

const d = (n: number) => addDays(D0, n)
function runner<O>(apply: (s: DemoState, op: O) => { ok: boolean; value?: DemoState; error?: string }) {
  return {
    run: (s: DemoState, op: O): DemoState => {
      const r = apply(s, op)
      if (!r.ok) throw new Error(r.error)
      return r.value as DemoState
    },
    fail: (s: DemoState, op: O): string => {
      const r = apply(s, op)
      if (r.ok) throw new Error('debía fallar')
      return r.error as string
    },
  }
}
const C = runner<ConsentOp>(applyConsentOp)
const V = runner<VendorOp>(applyVendorOp)
const P = runner<ProjectOp>(applyProjectOp)
const G = runner<CommitteeOp>(applyCommitteeOp)
const A = runner<AlertOp>(applyAlertOp)
const after = (n: number) => {
  let s = createInitialState()
  for (let i = 0; i < n; i++) s = applyNextEvent(s).state
  return s
}
const consent = (s: DemoState, id: string) => s.data.consents.find((c) => c.id === id)!
const vendor = (s: DemoState, id: string) => s.data.vendors.find((v) => v.id === id)!

describe('consentimientos (MD §6.6)', () => {
  it('la baja resta de vigentes, suma a revocados y agrega un movimiento', () => {
    const s = createInitialState()
    const next = C.run(s, { kind: 'revoke', id: 'CON-01', quantity: 100, reason: 'Solicitud de los titulares por el enlace de baja.' })
    expect(consent(next, 'CON-01')).toMatchObject({ active: consent(s, 'CON-01').active - 100, revoked: consent(s, 'CON-01').revoked + 100 })
    expect(consent(next, 'CON-01').movements.at(-1)).toMatchObject({ kind: 'Revocación', quantity: 100, note: '100 revocaciones, lote', date: D0 })
    expect(consentStatus(consent(next, 'CON-01'), next)).toBe('Con revocaciones')
    expect(dashboardKpis(next).registro.revocations30).toBe(100)
  })

  it('valida cantidad (≥1 y ≤ vigentes) y motivo en línea', () => {
    const c = consent(createInitialState(), 'CON-08')
    expect(validateRevocation(c, '0', 'x').quantity).toBeDefined()
    expect(validateRevocation(c, '1.5', 'x').quantity).toBeDefined()
    expect(validateRevocation(c, String(c.active + 1), 'x').quantity).toContain(String(c.active))
    expect(validateRevocation(c, String(c.active), ' ').reason).toBeDefined()
    expect(validateRevocation(c, '1', 'motivo')).toEqual({})
    expect(C.fail(createInitialState(), { kind: 'revoke', id: 'CON-08', quantity: 99999, reason: 'x' })).toContain('no puede superar')
  })

  it('Marcar validación realizada quita el "Por validar"', () => {
    const s = after(3)
    expect(consentStatus(consent(s, 'CON-02'), s)).toBe('Por validar')
    const next = C.run(s, { kind: 'validate', id: 'CON-02' })
    expect(consent(next, 'CON-02').lastValidatedAt).toBe(s.clock)
    expect(consentStatus(consent(next, 'CON-02'), next)).not.toBe('Por validar')
    expect(consentTone(consent(next, 'CON-02'), next)).toBe('ok')
    expect(processTone('P8', next)).toBe('ok')
  })

  it('Validar campaña calcula con los datos reales y solo deja registro (AC-11)', () => {
    const s = createInitialState()
    const c = consent(s, 'CON-01')
    expect(simulateCampaign(c, 9000)).toEqual({ enabled: c.active > 9000 ? 9000 : c.active, without: Math.max(0, 9000 - c.active) })
    expect(simulateCampaign({ ...c, active: 8143 }, 9000)).toEqual({ enabled: 8143, without: 857 })
    expect(simulateCampaign({ ...c, active: 500 }, 100)).toEqual({ enabled: 100, without: 0 })
    expect(validateListSize('0')).not.toBeNull()
    const next = C.run(s, { kind: 'campaign', id: 'CON-01', size: 9000 })
    expect(consent(next, 'CON-01').active).toBe(c.active)
    expect(consent(next, 'CON-01').history.at(-1)?.text).toContain('(simulada)')
  })
})

describe('proveedores y transferencias (MD §6.7, AC-24)', () => {
  it('E5: sin DPA ni garantía queda en rojo; definir la garantía recalcula pero sigue rojo hasta tener DPA', () => {
    const s = after(5)
    const k = s.data.vendors.at(-1)!
    expect(vendorStatus(k, s)).toEqual({ tone: 'crit', label: 'Sin DPA ni garantía' })
    const g = V.run(s, { kind: 'guarantee', id: k.id, text: 'Cláusulas contractuales tipo', ref: 'GAR-011.pdf' })
    expect(vendorStatus(vendor(g, k.id), g)).toEqual({ tone: 'crit', label: 'Sin DPA' })
    expect(dashboardKpis(g).registro.transfersWithoutGuarantee).toBe(0)
    const full = V.run(g, { kind: 'dpa', id: k.id, expiresAt: d(400), ref: 'DPA-011.pdf' })
    expect(vendorStatus(vendor(full, k.id), full).tone).toBe('ok')
    expect(vendorTone(vendor(full, k.id), full)).toBe('ok')
  })

  it('con DPA vigente pero sin garantía en una transferencia internacional: "Sin garantía" en rojo', () => {
    const s = after(5)
    const k = s.data.vendors.at(-1)!
    const withDpa = V.run(s, { kind: 'dpa', id: k.id, expiresAt: d(400), ref: 'DPA.pdf' })
    expect(vendorStatus(vendor(withDpa, k.id), withDpa)).toEqual({ tone: 'crit', label: 'Sin garantía' })
  })

  it('el mecanismo exige al menos 5 caracteres y referencia; un proveedor nacional no lo exige', () => {
    expect(validateGuarantee({ text: 'abc', ref: '' })).toEqual({ text: expect.stringContaining('al menos 5'), ref: expect.any(String) })
    const s = createInitialState()
    expect(V.fail(s, { kind: 'guarantee', id: 'PRV-005', text: 'Cláusulas tipo', ref: 'x' })).toContain('no tiene transferencia internacional')
  })

  it('Solicitar DPA o garantía marca lo solicitado y deja recordatorio simulado al área', () => {
    const s = after(5)
    const k = s.data.vendors.at(-1)!
    const next = V.run(s, { kind: 'request', id: k.id })
    expect(vendor(next, k.id).requested).toEqual({ dpa: true, guarantee: true })
    expect(vendor(next, k.id).history.at(-1)?.text).toBe('Recordatorio simulado enviado a Tecnología para obtener DPA y mecanismo de garantía')
    expect(V.fail(createInitialState(), { kind: 'request', id: 'PRV-001' })).toContain('no tiene documentos pendientes')
  })

  it('contrato vencido o por vencer: actualizar el vencimiento recalcula el semáforo', () => {
    const s = after(7)
    const c = s.data.vendors.find((v) => v.contractExpiresAt === d(20))!
    expect(vendorStatus(c, s)).toEqual({ tone: 'crit', label: 'Contrato vencido' })
    const next = V.run(s, { kind: 'contract', id: c.id, date: d(200) })
    expect(vendorStatus(vendor(next, c.id), next)).toEqual({ tone: 'ok', label: 'Vigente' })
    expect(V.fail(s, { kind: 'contract', id: c.id, date: '' })).toContain('fecha')
    const soon = V.run(createInitialState(), { kind: 'contract', id: c.id, date: d(10) })
    expect(vendorStatus(vendor(soon, c.id), soon)).toEqual({ tone: 'warn', label: 'Vence en 10 d' })
  })

  it('evaluar madurez y revisión anual usan el reloj de demo', () => {
    const s = after(3)
    const next = V.run(V.run(s, { kind: 'maturity', id: 'PRV-009', level: 'Alta' }), { kind: 'review', id: 'PRV-009' })
    expect(vendor(next, 'PRV-009')).toMatchObject({ maturity: 'Alta', maturityAt: s.clock, lastReviewAt: s.clock })
  })

  it('Agregar proveedor: país distinto de Chile fuerza transferencia internacional; nace sin DPA (rojo)', () => {
    expect(forcesInternational('España')).toBe(true)
    expect(forcesInternational('Chile')).toBe(false)
    const s = V.run(createInitialState(), { kind: 'add', input: { name: 'Proveedor Nube L', category: 'Almacenamiento', area: 'Tecnología', country: 'Alemania', international: false } })
    const v = s.data.vendors.at(-1)!
    expect(v).toMatchObject({ id: 'PRV-011', international: true, dpa: 'Sin DPA', maturity: 'Sin evaluar' })
    expect(vendorStatus(v, s).tone).toBe('crit')
    expect(V.fail(createInitialState(), { kind: 'add', input: { name: ' ', category: '', area: '', country: '', international: false } })).toBeDefined()
  })
})

describe('matriz de riesgo (MD §6.8, AC-12)', () => {
  const alto: ScreeningAnswers = [true, true, false, true, false]

  it('registra y evalúa en un paso; el resultado sigue la regla determinista', () => {
    const s = P.run(createInitialState(), { kind: 'register', name: 'Chatbot de cobranza', lead: 'Jefatura de Finanzas', answers: alto })
    const p = s.data.projects.at(-1)!
    expect(p).toMatchObject({ id: 'PRY-005', evaluatedAt: D0, checklistRef: null })
    expect(projectView(p)).toMatchObject({ risk: 'Alto', screening: { requiresEipd: true, channels: ['RAT', 'Consentimientos'] } })
    expect(dashboardKpis(s).riesgo.requireEipd).toBe(2)
  })

  it('sin jefe de proyecto o con respuestas en blanco no se puede guardar', () => {
    expect(validateProject({ name: 'X', lead: ' ', answers: alto }).lead).toBeDefined()
    expect(validateProject({ name: 'X', lead: 'Y', answers: BLANK }).answers).toBeDefined()
    expect(validateProject({ name: 'X', lead: 'Y', answers: [true, null, true, true, true] }).answers).toBeDefined()
    expect(P.fail(createInitialState(), { kind: 'register', name: 'X', lead: '', answers: alto })).toContain('jefe')
    expect(P.fail(createInitialState(), { kind: 'register', name: 'X', lead: 'Y', answers: BLANK })).toContain('Responde las 5')
  })

  it('evaluar el proyecto sin evaluar quita el amarillo del proceso P11', () => {
    const s = createInitialState()
    expect(processTone('P11', s)).toBe('warn')
    const next = P.run(s, { kind: 'evaluate', id: 'PRY-004', answers: [false, false, false, false, false] })
    expect(projectView(next.data.projects.at(-1)!).risk).toBe('Bajo')
    expect(processTone('P11', next)).toBe('ok')
    expect(sidebarData(next).tones['/riesgo']).toBe('ok')
  })

  it('reevaluar deja historial; si cambian las respuestas se invalida el checklist firmado', () => {
    const s = createInitialState()
    const p1 = s.data.projects.find((p) => p.id === 'PRY-001')!
    expect(p1.checklistRef).not.toBeNull()
    const next = P.run(s, { kind: 'evaluate', id: 'PRY-001', answers: [true, false, false, false, false] })
    const p = next.data.projects.find((x) => x.id === 'PRY-001')!
    expect(p.checklistRef).toBeNull()
    expect(p.history.at(-1)?.text).toContain('Reevaluado: riesgo Bajo → Medio')
    const same = P.run(s, { kind: 'evaluate', id: 'PRY-001', answers: [false, false, false, false, false] })
    expect(same.data.projects.find((x) => x.id === 'PRY-001')!.checklistRef).not.toBeNull()
  })

  it('Registrar checklist firmado pide fecha válida y referencia, y exige evaluación previa', () => {
    const s = createInitialState()
    expect(P.fail(s, { kind: 'sign', id: 'PRY-004', date: D0, ref: 'x.pdf' })).toContain('Evalúa el proyecto')
    expect(P.fail(s, { kind: 'sign', id: 'PRY-002', date: D0, ref: ' ' })).toContain('referencia')
    expect(P.fail(s, { kind: 'sign', id: 'PRY-002', date: d(3), ref: 'x.pdf' })).toContain('posterior')
    const next = P.run(s, { kind: 'sign', id: 'PRY-002', date: D0, ref: 'checklist_pry_2.pdf' })
    expect(next.data.projects.find((p) => p.id === 'PRY-002')).toMatchObject({ checklistRef: 'checklist_pry_2.pdf', checklistSignedAt: D0 })
  })
})

describe('comités (MD §6.9)', () => {
  it('"Vencido" se calcula contra el reloj; los acuerdos del seed vencen en D0+22', () => {
    const s = after(7)
    const st = s.data.committee.agreements.map((a) => agreementStatus(a, s.clock))
    expect(st.filter((x) => x === 'Vencido')).toHaveLength(2)
    expect(st.filter((x) => x === 'Pendiente')).toHaveLength(2)
    expect(st.filter((x) => x === 'Cumplido')).toHaveLength(2)
  })

  it('Registrar convocatoria (simulada): fecha, hora, lugar y asistentes; reprograma la sesión', () => {
    const s = createInitialState()
    const ok = { kind: 'convene' as const, sessionId: 'SES-003', date: d(26), time: '10:00', place: 'Sala 3', attendees: 'Legal, TI, RRHH' }
    const next = G.run(s, ok)
    expect(next.data.committee.sessions.find((x) => x.id === 'SES-003')).toMatchObject({ date: d(26), convocation: { time: '10:00', place: 'Sala 3' } })
    expect(Object.keys(validateConvocation(s, { date: d(-1), time: '', place: ' ', attendees: '' })).sort()).toEqual(['attendees', 'date', 'place', 'time'])
    expect(G.fail(s, { ...ok, sessionId: 'SES-001' })).toContain('próxima sesión')
  })

  it('editar la agenda de la próxima sesión: agregar y quitar puntos', () => {
    const s = createInitialState()
    const a = G.run(s, { kind: 'agendaAdd', sessionId: 'SES-003', item: 'Revisión de proveedores' })
    expect(a.data.committee.sessions.find((x) => x.id === 'SES-003')!.agenda).toHaveLength(3)
    const b = G.run(a, { kind: 'agendaRemove', sessionId: 'SES-003', index: 0 })
    expect(b.data.committee.sessions.find((x) => x.id === 'SES-003')!.agenda[0]).toBe('Avance de la certificación MPI')
    expect(G.fail(s, { kind: 'agendaAdd', sessionId: 'SES-003', item: ' ' })).toContain('Escribe')
    expect(G.fail(s, { kind: 'agendaRemove', sessionId: 'SES-003', index: 9 })).toContain('No existe')
  })

  it('registrar acuerdo valida campos; una fecha pasada se permite con aviso', () => {
    const s = after(3)
    expect(G.fail(s, { kind: 'agreement', description: '', owner: '', dueAt: '' })).toBeDefined()
    expect(dueAlreadyPassed(d(1), s.clock)).toBe(true)
    expect(dueAlreadyPassed(d(30), s.clock)).toBe(false)
    const next = G.run(s, { kind: 'agreement', description: 'Revisar el contrato', owner: 'Legal Sanitor', dueAt: d(1) })
    expect(next.data.committee.agreements.at(-1)).toMatchObject({ id: 'ACU-007', status: 'Pendiente', sessionId: 'SES-002' })
    expect(agreementStatus(next.data.committee.agreements.at(-1)!, next.clock)).toBe('Vencido')
  })

  it('seguimiento y cambio de estado: Cumplido registra la fecha y quita el vencido', () => {
    const s = after(7)
    const f = G.run(s, { kind: 'followUp', id: 'ACU-003', text: 'En revisión con el área' })
    expect(f.data.committee.agreements.find((a) => a.id === 'ACU-003')!.followUps).toEqual([{ date: s.clock, text: 'En revisión con el área' }])
    expect(G.fail(s, { kind: 'followUp', id: 'ACU-003', text: 'ok' })).toContain('al menos 5')
    const done = G.run(G.run(s, { kind: 'status', id: 'ACU-003', status: 'Cumplido' }), { kind: 'status', id: 'ACU-004', status: 'Cumplido' })
    expect(done.data.committee.agreements.find((a) => a.id === 'ACU-003')).toMatchObject({ status: 'Cumplido', doneAt: s.clock })
    expect(processTone('P9', done)).toBe('warn')
    expect(G.fail(done, { kind: 'status', id: 'ACU-003', status: 'Cumplido' })).toContain('ya está')
  })

  it('el acta compone agenda y acuerdos con cumplidos y vencidos', () => {
    const s = after(7)
    const acta = buildActa(s, 'SES-002')!
    expect(acta.agreements).toHaveLength(4)
    expect(acta).toMatchObject({ overdue: 2, fulfilled: 0 })
    const proxima = buildActa(s, 'SES-003')!
    expect(proxima.agreements.every((x) => x.status !== 'Cumplido')).toBe(true)
    expect(buildActa(s, 'SES-99')).toBeUndefined()
    expect(G.run(s, { kind: 'acta', sessionId: 'SES-002' }).log.at(-1)?.action).toContain('acta')
  })
})

describe('alertas y SLA (MD §6.2)', () => {
  it('Marcar atendida baja el contador; las de evento y las de regla se atienden igual', () => {
    const s = after(7)
    const before = newAlerts(s).length
    const ev = A.run(s, { kind: 'attend', id: 'evento:E7:ARCOP-0003' })
    const rule = A.run(ev, { kind: 'attend', id: 'regla:acuerdo-vencido:ACU-003' })
    expect(newAlerts(rule)).toHaveLength(before - 2)
    expect(sidebarData(rule).counters['/alertas']).toBe(before - 2)
    expect(allAlerts(rule).find((a) => a.id === 'evento:E7:ARCOP-0003')?.status).toBe('Atendida')
    expect(A.fail(ev, { kind: 'attend', id: 'evento:E7:ARCOP-0003' })).toContain('ya está atendida')
    expect(A.fail(s, { kind: 'attend', id: 'regla:inexistente:-' })).toContain('ya no existe')
  })

  it('una alerta atendida vuelve como nueva si la condición escala', () => {
    const s = after(3)
    const por = A.run(s, { kind: 'attend', id: 'regla:arcop-por-vencer:ARCOP-0003' })
    expect(allAlerts(por).find((a) => a.id === 'regla:arcop-por-vencer:ARCOP-0003')?.status).toBe('Atendida')
    let t = por
    for (let i = 3; i < 7; i++) t = applyNextEvent(t).state
    expect(allAlerts(t).find((a) => a.id === 'regla:arcop-vencida:ARCOP-0003')?.status).toBe('Nueva')
  })

  it('Enviar recordatorio (simulado) deja el registro en el historial del caso, no envía nada', () => {
    const s = after(7)
    const alert = allAlerts(s).find((a) => a.id === 'regla:arcop-vencida:ARCOP-0003')!
    expect(reminderTarget(s, alert)).toEqual({ who: 'Legal de Sanitor', entity: 'ARCOP-0003' })
    const next = A.run(s, { kind: 'reminder', id: alert.id })
    expect(next.data.arcop.find((r) => r.id === 'ARCOP-0003')!.history.at(-1)?.text).toBe('Recordatorio simulado enviado a Legal de Sanitor')
    const acuerdo = allAlerts(s).find((a) => a.id === 'regla:acuerdo-vencido:ACU-003')!
    expect(reminderTarget(s, acuerdo)?.who).toBe('Compras')
    const rat = allAlerts(s).find((a) => a.id === 'regla:rat-fuera-de-plazo:RAT-S-001')!
    expect(reminderTarget(s, rat)?.who).toBe('DPD')
    const review = allAlerts(s).find((a) => a.id === 'regla:rat-revision-por-vencer:-')!
    expect(reminderTarget(s, review)).toBeNull()
    expect(A.fail(s, { kind: 'reminder', id: review.id })).toContain('no tiene un responsable')
  })
})

describe('parámetros (MD §5.4, AC-10)', () => {
  it('guardar recalcula semáforos y alertas; restaurar vuelve a los valores por defecto', () => {
    const s = createInitialState()
    expect(newAlerts(s).some((a) => a.id.startsWith('regla:arcop-por-vencer'))).toBe(false)
    const parsed = parseParams({ ...Object.fromEntries(Object.entries(DEFAULT_PARAMS).map(([k, v]) => [k, String(v)])), dueSoonDays: '25' } as Record<keyof typeof DEFAULT_PARAMS, string>)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const saved = reducer(s, { type: 'setParams', params: parsed.value })
    expect(saved.params.dueSoonDays).toBe(25)
    expect(processTone('P1', saved)).toBe('warn')
    expect(allAlerts(saved).some((a) => a.id === 'regla:arcop-por-vencer:ARCOP-0003')).toBe(true)
    expect(saved.log.at(-1)?.entity).toBe('Parámetros')
    const restored = reducer(saved, { type: 'resetParams' })
    expect(restored.params).toEqual(DEFAULT_PARAMS)
    expect(processTone('P1', restored)).toBe('ok')
  })
})
