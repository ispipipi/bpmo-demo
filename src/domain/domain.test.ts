import { describe, expect, it } from 'vitest'
import { D0 } from '../config'
import { addDays } from '../lib/dates'
import { CATALOG, CATEGORIES, isIncluded } from './catalog'
import { allAlerts, newAlerts } from './derive/alerts'
import { dashboardKpis, sidebarData } from './derive/kpis'
import { mpiCompliancePct } from './derive/mpi'
import {
  arcopDue,
  arcopTone,
  consentStatus,
  consentTone,
  ratRequestTone,
  ratReviewTone,
  screening,
  slaTone,
  vendorTone,
} from './derive/sla'
import { categoryTone, nextSession, processTone } from './derive/tones'
import { applyNextEvent } from './events'
import { DEFAULT_PARAMS, parseParams } from './params'
import { createInitialState } from './seed'
import { worstTone } from './tone'
import type { DemoState } from './types'

const d = (n: number) => addDays(D0, n)

/** Estado tras aplicar los primeros n eventos guionados. */
function afterEvents(n: number): DemoState {
  let s = createInitialState()
  for (let i = 0; i < n; i++) s = applyNextEvent(s).state
  return s
}

const arcop = (s: DemoState, id: string) => {
  const r = s.data.arcop.find((x) => x.id === id)
  if (!r) throw new Error(`Falta ${id}`)
  return r
}
const arcopToneOf = (s: DemoState, id: string) => arcopTone(arcop(s, id), s)
const ratReq = (s: DemoState, id: string) => {
  const r = s.data.rat.requests.find((x) => x.id === id)
  if (!r) throw new Error(`Falta ${id}`)
  return r
}
const vendorContract20 = (s: DemoState) => {
  const v = s.data.vendors.find((x) => x.contractExpiresAt === d(20))
  if (!v) throw new Error('Falta proveedor con contrato D0+20')
  return v
}
const consentD85 = (s: DemoState) => {
  const c = s.data.consents.find((x) => x.lastValidatedAt === d(-85))
  if (!c) throw new Error('Falta consentimiento D0-85')
  return c
}

describe('catálogo (MD §6.0)', () => {
  it('tiene 22 procesos con 14 H2D, 5 Compartido y 3 Cliente', () => {
    expect(CATALOG).toHaveLength(22)
    const count = (r: string) => CATALOG.filter((p) => p.responsible === r).length
    expect(count('H2D')).toBe(14)
    expect(count('Compartido')).toBe(5)
    expect(count('Cliente (supervisión H2D)')).toBe(3)
  })

  it('deja 10 incluidos y 12 no incluidos, con numeración P1…P21 más P6a y P6b', () => {
    expect(CATALOG.filter(isIncluded)).toHaveLength(10)
    expect(CATALOG.filter((p) => !isIncluded(p))).toHaveLength(12)
    const ids = CATALOG.map((p) => p.id).sort()
    const expected = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6a', 'P6b', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12', 'P13', 'P14', 'P15', 'P16', 'P17', 'P18', 'P19', 'P20', 'P21']
    expect(ids).toEqual([...expected].sort())
  })

  it('reparte los procesos en las 7 categorías del documento', () => {
    const by = (c: string) => CATALOG.filter((p) => p.category === c).length
    expect(CATEGORIES.map(by)).toEqual([4, 3, 5, 1, 4, 4, 1])
  })
})

describe('seed (MD §4.1, regla de diseño §5.3)', () => {
  const s = createInitialState()

  it('ARCOP: 8 casos con los vencimientos del MD', () => {
    expect(s.data.arcop).toHaveLength(8)
    expect(['ARCOP-0001', 'ARCOP-0002', 'ARCOP-0008'].map((id) => arcop(s, id).status)).toEqual(['Cerrada', 'Cerrada', 'Cerrada'])
    expect(arcop(s, 'ARCOP-0008').resolution).toBe('Improcedente')
    expect(arcop(s, 'ARCOP-0003').extension).toBeNull()
    expect(arcopDue(arcop(s, 'ARCOP-0003'), s.params)).toBe(d(20))
    for (const id of ['ARCOP-0004', 'ARCOP-0005', 'ARCOP-0006']) {
      expect(arcop(s, id).extension).not.toBeNull()
      expect(arcopDue(arcop(s, id), s.params)).toBe(d(40))
    }
    expect(arcop(s, 'ARCOP-0005').status).toBe('Respuesta lista')
    expect(arcop(s, 'ARCOP-0007').status).toBe('Nueva')
    expect(arcop(s, 'ARCOP-0007').receivedAt).toBe(D0)
    expect(arcopDue(arcop(s, 'ARCOP-0007'), s.params)).toBe(d(30))
  })

  it('ninguna ARCOP abierta distinta de ARCOP-0003 vence antes de D0+30', () => {
    for (const r of s.data.arcop.filter((x) => x.status !== 'Cerrada' && x.id !== 'ARCOP-0003')) {
      expect(arcopDue(r, s.params) >= d(30)).toBe(true)
      expect(r.receivedAt <= D0).toBe(true)
    }
  })

  it('cada caso ARCOP tiene 5 subtareas de la plantilla', () => {
    for (const r of s.data.arcop) expect(r.subtasks).toHaveLength(5)
    expect(arcop(s, 'ARCOP-0001').subtasks.map((t) => t.name)[0]).toBe('Verificar identidad del titular')
  })

  it('RAT: versión 12 en D0-5, 14 actividades y 3 solicitudes', () => {
    expect(s.data.rat.version).toBe(12)
    expect(s.data.rat.updatedAt).toBe(d(-5))
    expect(s.data.rat.reviewedAt).toBe(d(-5))
    expect(s.data.rat.activities).toHaveLength(14)
    expect(s.data.rat.requests.map((r) => r.status)).toEqual(['En validación', 'Recibida', 'Registrada'])
    const v = ratReq(s, 'RAT-S-001')
    expect(Object.values(v.approvals).filter((a) => a.state === 'Aprobado')).toHaveLength(3)
    expect(v.receivedAt).toBe(d(-3))
  })

  it('consentimientos, proveedores, proyectos, MPI, hallazgos y comité', () => {
    expect(s.data.consents).toHaveLength(8)
    expect(consentD85(s).lastValidatedAt).toBe(d(-85))
    expect(s.data.vendors).toHaveLength(10)
    expect(s.data.vendors.filter((v) => v.international)).toHaveLength(4)
    expect(s.data.projects).toHaveLength(4)
    expect(s.data.projects.filter((p) => p.evaluatedAt !== null)).toHaveLength(3)
    expect(s.data.projects.filter((p) => screening(p.answers)?.risk === 'Alto')).toHaveLength(1)
    const items = s.data.mpi.items
    expect(items).toHaveLength(12)
    expect(items.filter((i) => i.state === 'Cumple')).toHaveLength(8)
    expect(items.filter((i) => i.state === 'En progreso')).toHaveLength(3)
    expect(items.filter((i) => i.state === 'No aplica')).toHaveLength(1)
    expect(s.data.mpi.status).toBe('En preparación')
    expect(s.data.findings).toHaveLength(1)
    expect(s.data.findings[0]?.stage).toBe('Cerrado')
    expect(s.data.committee.sessions).toHaveLength(3)
    expect(s.data.committee.agreements).toHaveLength(6)
    expect(nextSession(s)?.date).toBe(d(25))
    const open = s.data.committee.agreements.filter((a) => a.status === 'Pendiente').map((a) => a.dueAt)
    expect(open).toContain(d(18))
    expect(open).toContain(d(21))
    expect(open.filter((x) => x !== d(18) && x !== d(21)).every((x) => x > d(30))).toBe(true)
  })

  it('el seed no depende del estado compartido: dos estados son independientes', () => {
    const a = createInitialState()
    const b = createInitialState()
    a.data.arcop[0]!.holder = 'cambiado'
    expect(b.data.arcop[0]!.holder).not.toBe('cambiado')
  })
})

describe('semáforos de ARCOP (MD §5.3)', () => {
  it('D0: todas las abiertas en verde', () => {
    const s = afterEvents(0)
    expect(s.clock).toBe(D0)
    for (const r of s.data.arcop.filter((x) => x.status !== 'Cerrada')) expect(arcopTone(r, s)).toBe('ok')
  })

  it('D0+16 (E3): solo ARCOP-0003 pasa a amarillo; 0009 y 0010 siguen en verde', () => {
    const s = afterEvents(3)
    expect(s.clock).toBe(d(16))
    expect(arcopToneOf(s, 'ARCOP-0003')).toBe('warn')
    for (const id of ['ARCOP-0004', 'ARCOP-0005', 'ARCOP-0006', 'ARCOP-0007', 'ARCOP-0009', 'ARCOP-0010']) {
      expect(arcopToneOf(s, id)).toBe('ok')
    }
    expect(arcopDue(arcop(s, 'ARCOP-0009'), s.params)).toBe(d(30))
  })

  it('D0+22 (E7): ARCOP-0003 en rojo; 0007, 0009, 0010 (8 días) y 0004-0006 en verde', () => {
    const s = afterEvents(7)
    expect(s.clock).toBe(d(22))
    expect(arcopToneOf(s, 'ARCOP-0003')).toBe('crit')
    for (const id of ['ARCOP-0004', 'ARCOP-0005', 'ARCOP-0006', 'ARCOP-0007', 'ARCOP-0009', 'ARCOP-0010']) {
      expect(arcopToneOf(s, id)).toBe('ok')
    }
  })
})

describe('semáforos de otros módulos (MD §5.3)', () => {
  it('solicitud RAT en validación: verde, rojo, rojo', () => {
    expect(ratRequestTone(ratReq(afterEvents(0), 'RAT-S-001'), afterEvents(0))).toBe('ok')
    expect(ratRequestTone(ratReq(afterEvents(3), 'RAT-S-001'), afterEvents(3))).toBe('crit')
    expect(ratRequestTone(ratReq(afterEvents(7), 'RAT-S-001'), afterEvents(7))).toBe('crit')
  })

  it('revisión mensual del RAT (vence D0+25): verde, verde, amarillo', () => {
    expect(ratReviewTone(afterEvents(0))).toBe('ok')
    expect(ratReviewTone(afterEvents(3))).toBe('ok')
    expect(ratReviewTone(afterEvents(7))).toBe('warn')
  })

  it('solicitud RAT creada por E4 (D0+16, vence D0+31): verde en D0+16 y D0+22', () => {
    const s16 = afterEvents(4)
    const s22 = afterEvents(7)
    expect(s16.clock).toBe(d(16))
    expect(ratRequestTone(ratReq(s16, 'RAT-S-004'), s16)).toBe('ok')
    expect(ratRequestTone(ratReq(s22, 'RAT-S-004'), s22)).toBe('ok')
  })

  it('contrato de proveedor que vence D0+20: amarillo, amarillo, rojo', () => {
    expect(vendorTone(vendorContract20(afterEvents(0)), afterEvents(0))).toBe('warn')
    expect(vendorTone(vendorContract20(afterEvents(3)), afterEvents(3))).toBe('warn')
    expect(vendorTone(vendorContract20(afterEvents(7)), afterEvents(7))).toBe('crit')
  })

  it('consentimiento con validación que vence D0+5: amarillo en los tres momentos; "Por validar" desde D0+16', () => {
    for (const n of [0, 3, 7]) expect(consentTone(consentD85(afterEvents(n)), afterEvents(n))).toBe('warn')
    expect(consentStatus(consentD85(afterEvents(0)), afterEvents(0))).not.toBe('Por validar')
    expect(consentStatus(consentD85(afterEvents(3)), afterEvents(3))).toBe('Por validar')
  })

  it('certificación MPI y proyecto sin evaluar: amarillo en los tres momentos', () => {
    for (const n of [0, 3, 7]) {
      expect(processTone('P20', afterEvents(n))).toBe('warn')
      expect(processTone('P11', afterEvents(n))).toBe('warn')
    }
  })

  it('acuerdos de comité (D0+18 y D0+21): verde, verde, rojo con aviso de próximo comité a 3 días', () => {
    expect(processTone('P9', afterEvents(0))).toBe('ok')
    expect(processTone('P9', afterEvents(3))).toBe('ok')
    const s = afterEvents(7)
    expect(processTone('P9', s)).toBe('crit')
    expect(s.data.committee.agreements.filter((a) => a.status === 'Pendiente' && a.dueAt < s.clock)).toHaveLength(2)
    expect(dashboardKpis(s).gobernanza.nextCommitteeInDays).toBe(3)
    expect(ruleIds(s)).toContain('regla:comite-proximo:SES-003')
  })
})

const ruleIds = (s: DemoState) => allAlerts(s).map((a) => a.id)

describe('estado derivado de cada proceso y de la categoría (MD §6.0, AC-22)', () => {
  it('en D0 el seed da P1 verde, P6b verde, P8 amarillo, proveedores amarillo, P19 verde', () => {
    const s = afterEvents(0)
    expect(processTone('P1', s)).toBe('ok')
    expect(processTone('P6b', s)).toBe('ok')
    expect(processTone('P8', s)).toBe('warn')
    expect(processTone('P10', s)).toBe('warn')
    expect(processTone('P17', s)).toBe('warn')
    expect(processTone('P19', s)).toBe('ok')
  })

  it('P4 es informativo y los procesos no incluidos no tienen semáforo', () => {
    const s = afterEvents(0)
    expect(processTone('P4', s)).toBe('info')
    for (const p of CATALOG.filter((x) => !isIncluded(x))) expect(processTone(p.id, s)).toBe('na')
  })

  it('la categoría es el peor de sus procesos incluidos; Cultura queda gris', () => {
    const s = afterEvents(7)
    expect(categoryTone('Atención a titulares y a la autoridad', s)).toBe('crit')
    expect(categoryTone('Registro y documentación', s)).toBe('crit')
    expect(categoryTone('Terceros', s)).toBe('crit')
    expect(categoryTone('Gobernanza interna', s)).toBe('crit')
    expect(categoryTone('Gestión de riesgo y proyectos', s)).toBe('warn')
    expect(categoryTone('Reporte y mejora continua', s)).toBe('info')
    expect(categoryTone('Cultura', s)).toBe('na')
    expect(worstTone(['ok', 'na', 'warn'])).toBe('warn')
  })

  it('P19: hallazgo abierto sin gravedad es amarillo; con gravedad Alta es rojo', () => {
    const s = afterEvents(8)
    expect(processTone('P19', s)).toBe('warn')
    const f = s.data.findings.find((x) => x.id === 'HAL-0002')!
    const alta: DemoState = { ...s, data: { ...s.data, findings: s.data.findings.map((x) => (x === f ? { ...x, severity: 'Alta' as const } : x)) } }
    expect(processTone('P19', alta)).toBe('crit')
    expect(ruleIds(alta)).toContain('regla:autodenuncia-gravedad-alta:HAL-0002')
  })

  it('P20: algún ítem "No cumple" es rojo; todos cumplen con certificación Vigente es verde', () => {
    const s = afterEvents(0)
    const withItem = (state: NonNullable<DemoState['data']['mpi']['items'][number]['state']>): DemoState => ({
      ...s,
      data: { ...s.data, mpi: { ...s.data.mpi, items: s.data.mpi.items.map((i, idx) => (idx === 4 ? { ...i, state } : i)) } },
    })
    expect(processTone('P20', withItem('No cumple'))).toBe('crit')
    const allOk: DemoState = {
      ...s,
      data: { ...s.data, mpi: { ...s.data.mpi, status: 'Vigente', items: s.data.mpi.items.map((i) => (i.state === 'En progreso' ? { ...i, state: 'Cumple' as const } : i)) } },
    }
    expect(processTone('P20', allOk)).toBe('ok')
  })

  it('P6b: revisión mensual vencida es rojo', () => {
    const s: DemoState = { ...afterEvents(0), clock: d(26) }
    expect(ratReviewTone(s)).toBe('crit')
    expect(processTone('P6b', s)).toBe('crit')
  })
})

describe('eventos guionados (MD §5.2)', () => {
  it('aplica E1…E8 en orden, una vez cada uno, y luego informa "Sin novedades"', () => {
    let s = createInitialState()
    const ids: (string | null)[] = []
    for (let i = 0; i < 8; i++) {
      const r = applyNextEvent(s)
      ids.push(r.eventId)
      s = r.state
    }
    expect(ids).toEqual(['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8'])
    expect(s.nextEvent).toBe(8)
    const last = applyNextEvent(s)
    expect(last.message).toBe('Sin novedades. Todo al día (simulado)')
    expect(last.state).toBe(s)
  })

  it('solo E3 y E7 mueven el reloj', () => {
    let s = createInitialState()
    const clocks: string[] = []
    for (let i = 0; i < 8; i++) {
      s = applyNextEvent(s).state
      clocks.push(s.clock)
    }
    expect(clocks).toEqual([D0, D0, d(16), d(16), d(16), d(16), d(22), d(22)])
  })

  it('E1 y E2 crean ARCOP-0009 (Acceso) y ARCOP-0010 (Supresión) nuevas, sin analista, con vencimiento reloj + plazo', () => {
    const s = afterEvents(2)
    expect(arcop(s, 'ARCOP-0009')).toMatchObject({ type: 'Acceso', status: 'Nueva', analyst: null, channel: 'Formulario web' })
    expect(arcop(s, 'ARCOP-0010')).toMatchObject({ type: 'Supresión', status: 'Nueva', analyst: null })
    expect(arcopDue(arcop(s, 'ARCOP-0009'), s.params)).toBe(d(30))
    expect(sidebarData(s).counters['/arcop']).toBe(3)
  })

  it('E4 crea la solicitud RAT-S-004 en "Recibida" con la finalidad de fidelización', () => {
    const r = ratReq(afterEvents(4), 'RAT-S-004')
    expect(r.status).toBe('Recibida')
    expect(r.requester).toBe('Marketing')
    expect(r.description).toContain('campaña de fidelización')
    expect(Object.values(r.approvals).every((a) => a.state === 'Pendiente')).toBe(true)
  })

  it('E5 crea un proveedor alojado en España, con DPA "Sin DPA" y garantía sin definir, en rojo', () => {
    const s = afterEvents(5)
    const v = s.data.vendors.at(-1)!
    expect(v).toMatchObject({ country: 'España', international: true, dpa: 'Sin DPA', guarantee: null })
    expect(vendorTone(v, s)).toBe('crit')
  })

  it('E6 resta 37 a vigentes de "Newsletter", suma 37 a revocados y agrega un movimiento', () => {
    const before = afterEvents(5).data.consents.find((c) => c.purpose === 'Newsletter')!
    const s = afterEvents(6)
    const after = s.data.consents.find((c) => c.purpose === 'Newsletter')!
    expect(after.active).toBe(before.active - 37)
    expect(after.revoked).toBe(before.revoked + 37)
    expect(after.movements).toHaveLength(before.movements.length + 1)
    expect(dashboardKpis(s).registro.revocations30).toBe(37)
  })

  it('E7 deja ARCOP-0003 vencida, registra el incumplimiento y emite alerta crítica', () => {
    const s = afterEvents(7)
    expect(s.data.eventAlerts.find((a) => a.id === 'evento:E7:ARCOP-0003')?.severity).toBe('Crítica')
    expect(arcop(s, 'ARCOP-0003').history.at(-1)?.text).toContain('SLA incumplido')
  })

  it('E7 con ARCOP-0003 prorrogada: "Sin incumplimientos nuevos", y los acuerdos vencen igual', () => {
    let s = afterEvents(6)
    s = {
      ...s,
      data: { ...s.data, arcop: s.data.arcop.map((r) => (r.id === 'ARCOP-0003' ? { ...r, extension: { reason: 'Prórroga de prueba', date: s.clock, days: 30 } } : r)) },
    }
    const r = applyNextEvent(s)
    expect(r.message).toContain('Sin incumplimientos nuevos')
    expect(r.state.data.eventAlerts.some((a) => a.id === 'evento:E7:ARCOP-0003')).toBe(false)
    expect(processTone('P9', r.state)).toBe('crit')
  })

  it('E8 crea el hallazgo HAL-0002 en "Detectado" con la descripción del evento', () => {
    const f = afterEvents(8).data.findings.find((x) => x.id === 'HAL-0002')!
    expect(f).toMatchObject({ stage: 'Detectado', origin: 'Evento E8', severity: null })
    expect(f.description).toContain('ubicación no declarada en el RAT')
  })

  it('no muta el estado de entrada', () => {
    const s = createInitialState()
    const snapshot = JSON.stringify(s)
    applyNextEvent(s)
    expect(JSON.stringify(s)).toBe(snapshot)
  })
})

describe('Dashboard y alertas calculados desde los registros (AC-02)', () => {
  it('tras los 8 eventos las cifras coinciden con los registros', () => {
    const s = afterEvents(8)
    const k = dashboardKpis(s)
    expect(k.atencion).toMatchObject({ arcopOpen: 7, arcopOverdue: 1, arcopDueSoon: 0, mpiPct: 73, findingsOpen: 1 })
    expect(k.atencion.arcopClosedInTimePct).toBe(100)
    expect(k.registro).toMatchObject({ ratVersion: 12, activeHolders: 12480, revocations30: 37, transfersWithoutGuarantee: 1 })
    expect(k.terceros.withoutValidDpa).toBe(1)
    expect(k.gobernanza.overdueAgreements).toBe(2)
    expect(k.riesgo).toEqual({ unevaluated: 1, requireEipd: 1 })
    expect(k.reporte.lastMinutaAt).toBeNull()
  })

  it('el % de cerradas dentro de plazo es null (no 0 %) si no hay cerradas', () => {
    const s = createInitialState()
    s.data.arcop = s.data.arcop.filter((r) => r.status !== 'Cerrada')
    expect(dashboardKpis(s).atencion.arcopClosedInTimePct).toBeNull()
  })

  it('las alertas por regla se recalculan: desaparecen al cerrar el caso y se pueden marcar atendidas', () => {
    const s = afterEvents(7)
    expect(ruleIds(s)).toContain('regla:arcop-vencida:ARCOP-0003')
    const closed: DemoState = { ...s, data: { ...s.data, arcop: s.data.arcop.map((r) => (r.id === 'ARCOP-0003' ? { ...r, status: 'Cerrada' as const } : r)) } }
    expect(ruleIds(closed)).not.toContain('regla:arcop-vencida:ARCOP-0003')
    const before = newAlerts(s).length
    const attended: DemoState = { ...s, data: { ...s.data, attendedRuleIds: ['regla:arcop-vencida:ARCOP-0003'] } }
    expect(newAlerts(attended)).toHaveLength(before - 1)
    expect(sidebarData(attended).counters['/alertas']).toBe(before - 1)
  })

  it('ordena por severidad: la crítica va primero', () => {
    expect(allAlerts(afterEvents(7))[0]?.severity).toBe('Crítica')
  })

  it('cambiar un parámetro recalcula semáforos (AC-10)', () => {
    const s = afterEvents(0)
    expect(arcopToneOf(s, 'ARCOP-0003')).toBe('ok')
    const tight: DemoState = { ...s, params: { ...s.params, dueSoonDays: 25 } }
    expect(arcopToneOf(tight, 'ARCOP-0003')).toBe('warn')
    const short: DemoState = { ...s, params: { ...s.params, arcopDays: 5 } }
    expect(arcopToneOf(short, 'ARCOP-0003')).toBe('crit')
  })
})

describe('reglas puras', () => {
  it('slaTone: vencido, borde del umbral y en plazo', () => {
    expect(slaTone(d(-1), D0, 7)).toBe('crit')
    expect(slaTone(D0, D0, 7)).toBe('warn')
    expect(slaTone(d(7), D0, 7)).toBe('warn')
    expect(slaTone(d(8), D0, 7)).toBe('ok')
  })

  it('screening: riesgo determinista y canales (MD §6.8)', () => {
    expect(screening([false, false, false, false, false])).toMatchObject({ risk: 'Bajo', requiresEipd: false, channels: [] })
    expect(screening([true, false, false, false, false])).toMatchObject({ risk: 'Medio', requiresEipd: false })
    expect(screening([true, true, false, false, false])?.risk).toBe('Medio')
    expect(screening([true, true, true, false, false])).toMatchObject({ risk: 'Alto', requiresEipd: true })
    expect(screening([false, false, false, true, false])).toMatchObject({ risk: 'Alto', requiresEipd: true })
    expect(screening([true, true, false, false, false])?.channels).toEqual(['RAT', 'Consentimientos'])
    expect(screening([false, false, true, false, false])?.channels).toEqual(['Proveedores y transferencias'])
  })

  it('screening: respuestas en blanco no se pueden evaluar', () => {
    expect(screening([null, null, null, null, null])).toBeNull()
    expect(screening([true, null, false, false, false])).toBeNull()
  })

  it('MPI: "No aplica" no cuenta en el denominador', () => {
    expect(mpiCompliancePct(createInitialState().data.mpi)).toBe(73)
  })
})

describe('parámetros (MD §5.4)', () => {
  const raw = (over: Partial<Record<keyof typeof DEFAULT_PARAMS, string>> = {}) => {
    const base = Object.fromEntries(Object.entries(DEFAULT_PARAMS).map(([k, v]) => [k, String(v)])) as Record<keyof typeof DEFAULT_PARAMS, string>
    return { ...base, ...over }
  }

  it('acepta los valores por defecto', () => {
    const r = parseParams(raw())
    expect(r.ok && r.value).toEqual(DEFAULT_PARAMS)
  })

  it('rechaza valores fuera de rango, no enteros o vacíos, indicando el campo', () => {
    const r = parseParams(raw({ arcopDays: '0', dueSoonDays: '61', vendorNoticeDays: '181', ratReviewDays: '1.5', arcopExtensionDays: '' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.error).sort()).toEqual(['arcopDays', 'arcopExtensionDays', 'dueSoonDays', 'ratReviewDays', 'vendorNoticeDays'])
  })

  it('acepta los extremos de cada rango', () => {
    expect(parseParams(raw({ arcopDays: '365', dueSoonDays: '1', vendorNoticeDays: '180', ratValidationDays: '90' })).ok).toBe(true)
  })
})
