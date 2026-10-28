import { describe, expect, it } from 'vitest'
import { D0 } from '../config'
import { addDays } from '../lib/dates'
import { applyArcopOp } from './arcop'
import { dashboardKpis } from './derive/kpis'
import { applyNextEvent } from './events'
import { applyRatOp } from './rat'
import { generateMinuta, inRange, minuta, periodRange, report1, report1Table, report2, report2Table, report3, report3Table, report4, report4Table } from './reports'
import { createInitialState } from './seed'
import { APPROVERS, type DemoState } from './types'
import { reducer } from '../store/reducer'

const d = (n: number) => addDays(D0, n)
const after = (n: number) => {
  let s = createInitialState()
  for (let i = 0; i < n; i++) s = applyNextEvent(s).state
  return s
}

describe('períodos contra el reloj de demo', () => {
  it('Últimos 30 días, Mes actual y Todo', () => {
    expect(periodRange('30', D0)).toEqual({ from: d(-30), to: D0 })
    expect(periodRange('mes', D0)).toEqual({ from: '2027-01-01', to: D0 })
    expect(periodRange('mes', d(22))).toEqual({ from: '2027-02-01', to: d(22) })
    expect(periodRange('todo', D0)).toEqual({ from: null, to: D0 })
  })
  it('inRange respeta los bordes y las fechas nulas', () => {
    const r = periodRange('30', D0)
    expect(inRange(d(-30), r)).toBe(true)
    expect(inRange(d(-31), r)).toBe(false)
    expect(inRange(d(1), r)).toBe(false)
    expect(inRange(null, r)).toBe(false)
  })
})

describe('informe 1: estado de cumplimiento por proceso', () => {
  it('lista los 10 procesos incluidos agrupados en 6 categorías, con su evidencia y semáforo', () => {
    const secs = report1(createInitialState())
    expect(secs.map((x) => x.category)).toHaveLength(6)
    expect(secs.flatMap((x) => x.rows)).toHaveLength(10)
    const p1 = secs[0]!.rows.find((r) => r.id === 'P1')!
    expect(p1).toMatchObject({ status: { tone: 'ok', label: 'En plazo' }, evidence: 'Bitácora de solicitudes con fecha, plazo y resolución' })
    expect(p1.indicator).toBe('5 abiertas · 0 vencidas · 0 por vencer')
    expect(secs.at(-1)!.rows[0]!.indicator).toBe('Última minuta: —')
  })

  it('los indicadores coinciden con los registros tras los 8 eventos (AC-02)', () => {
    const s = after(8)
    const rows = report1(s).flatMap((x) => x.rows)
    const k = dashboardKpis(s)
    expect(rows.find((r) => r.id === 'P1')!.indicator).toBe(`${k.atencion.arcopOpen} abiertas · 1 vencidas · 0 por vencer`)
    expect(rows.find((r) => r.id === 'P8')!.indicator).toContain('12.480 titulares vigentes')
    expect(rows.find((r) => r.id === 'P17')!.indicator).toBe('5 transferencias · 1 sin mecanismo de garantía')
    expect(rows.find((r) => r.id === 'P9')!.indicator).toContain('2 acuerdos vencidos')
  })

  it('el CSV tiene una fila por proceso con sus 6 columnas', () => {
    const t = report1Table(report1(createInitialState()))
    expect(t.rows).toHaveLength(10)
    expect(t.rows.every((r) => r.length === t.header.length)).toBe(true)
  })
})

describe('informe 2: gestión de solicitudes ARCOP', () => {
  it('cuenta por tipo y estado en el período; en "Todo" suma las 8 del seed', () => {
    const r = report2(createInitialState(), 'todo')
    expect(r.total).toBe(8)
    const t = Object.fromEntries(r.byType.map((x) => [x.type, x]))
    expect(t['Acceso']!.total).toBe(3)
    expect(r.byType.reduce((n, x) => n + x.counts['Improcedente'], 0)).toBe(1)
    expect(r.byType.reduce((n, x) => n + x.counts['Cerrada'], 0)).toBe(2)
  })

  it('porcentaje en plazo y tiempo promedio solo sobre las cerradas respondidas', () => {
    const r = report2(createInitialState(), 'todo')
    expect(r.closedInTimePct).toBe(100)
    expect(r.avgCloseDays).toBe(25)
  })

  it('período sin ARCOP: los indicadores son null ("—"), no 0 %', () => {
    const s = createInitialState()
    const r = report2({ ...s, data: { ...s.data, arcop: [] } }, 'mes')
    expect(r).toMatchObject({ total: 0, closedInTimePct: null, avgCloseDays: null })
    const mes = report2(s, 'mes')
    expect(mes.total).toBe(2)
    expect(mes.closedInTimePct).toBeNull()
  })

  it('"Últimos 30 días" y "Mes actual" difieren según el reloj', () => {
    const s = createInitialState()
    expect(report2(s, '30').total).toBe(report2(s, 'todo').total - 2)
    expect(report2(after(7), 'mes').total).toBe(0)
  })

  it('un cierre fuera de plazo baja el porcentaje; el CSV refleja la tabla visible', () => {
    let s = after(7)
    for (const t of s.data.arcop.find((r) => r.id === 'ARCOP-0003')!.subtasks) {
      const r = applyArcopOp(s, { kind: 'subtask', id: 'ARCOP-0003', subtaskId: t.id, state: 'Completa' })
      if (r.ok) s = r.value
    }
    const resp = applyArcopOp(s, { kind: 'response', id: 'ARCOP-0003', text: 'Respuesta tardía' })
    if (!resp.ok) throw new Error(resp.error)
    const closed = applyArcopOp(resp.value, { kind: 'close', id: 'ARCOP-0003' })
    if (!closed.ok) throw new Error(closed.error)
    expect(report2(closed.value, 'todo').closedInTimePct).toBe(67)
    const t = report2Table(report2(closed.value, 'todo'))
    expect(t.header).toEqual(['Tipo', 'Nueva', 'En gestión', 'Respuesta lista', 'Cerrada', 'Improcedente', 'Total'])
    expect(t.rows).toHaveLength(5)
  })
})

describe('informe 3: RAT versionado y evidencias', () => {
  it('versión, fechas y actividades con las referencias de sus vistos buenos', () => {
    const r = report3(createInitialState(), 'todo')
    expect(r).toMatchObject({ version: 12, updatedAt: d(-5), reviewedAt: d(-5) })
    expect(r.activities).toHaveLength(14)
    expect(r.activities.find((a) => a.id === 'ACT-02')!.evidence).toEqual(['VB-010', 'VB-011', 'VB-012', 'VB-013', 'VB-014'])
    expect(r.activities.find((a) => a.id === 'ACT-01')!.evidence).toEqual([])
  })

  it('las solicitudes se filtran por período; el CSV marca "—" sin evidencia', () => {
    expect(report3(createInitialState(), 'todo').requests).toHaveLength(3)
    expect(report3(createInitialState(), 'mes').requests.map((x) => x.id)).toEqual(['RAT-S-001', 'RAT-S-002'])
    const t = report3Table(report3(createInitialState(), 'todo'))
    expect(t.rows.find((r) => r[0] === 'ACT-01')![5]).toBe('—')
    expect(t.rows).toHaveLength(14)
  })

  it('al registrar una creación la solicitud queda vinculada a la nueva actividad y su evidencia aparece', () => {
    let s = createInitialState()
    const run = (op: Parameters<typeof applyRatOp>[1]) => {
      const r = applyRatOp(s, op)
      if (!r.ok) throw new Error(r.error)
      s = r.value
    }
    run({ kind: 'start', id: 'RAT-S-002' })
    for (const approver of APPROVERS) run({ kind: 'approval', id: 'RAT-S-002', approver, result: 'Aprobado', date: D0, ref: `VB-${approver.slice(0, 2)}`, comment: '' })
    run({ kind: 'register', id: 'RAT-S-002' })
    const a = report3(s, 'todo').activities.find((x) => x.id === 'ACT-15')!
    expect(a.evidence).toHaveLength(5)
    expect(a.lastChange).toBe(D0)
  })
})

describe('informe 4: transferencias internacionales y garantías', () => {
  it('lista solo proveedores con transferencia internacional, con garantía y estado', () => {
    const rows = report4(createInitialState())
    expect(rows).toHaveLength(4)
    expect(rows.every((r) => r.guarantee !== null)).toBe(true)
    const e5 = report4(after(5))
    expect(e5).toHaveLength(5)
    expect(e5.at(-1)).toMatchObject({ country: 'España', dpa: 'Sin DPA', guarantee: null, status: 'Sin DPA ni garantía' })
    expect(report4Table(e5).rows.at(-1)![5]).toBe('Sin definir')
  })
})

describe('informe 5: minuta de reporte mensual (AC-25)', () => {
  it('compone semáforo por categoría, ARCOP del mes, alertas críticas y acuerdos vencidos con los datos vigentes', () => {
    const s = after(8)
    const m = minuta(s, { includeAlerts: true })
    expect(m.title).toBe('ESVAL · Febrero 2027')
    expect(m.categories).toHaveLength(6)
    const by = Object.fromEntries(m.categories.map((c) => [c.category, c]))
    expect(by['Atención a titulares y a la autoridad']).toMatchObject({ status: { tone: 'crit', label: 'Vencido' }, summary: 'ARCOP-0003 vencida; MPI 73 % en en preparación; 1 autodenuncia abierta' })
    expect(by['Gestión de riesgo y proyectos']!.summary).toBe('1 proyecto sin evaluar; 1 requiere EIPD')
    expect(by['Terceros']!.summary).toBe('1 proveedor sin DPA vigente')
    expect(by['Gobernanza interna']!.summary).toBe('2 acuerdos vencidos; próximo comité 06/02/2027')
    expect(by['Reporte y mejora continua']!.summary).toBe('Esta minuta')
    expect(m.arcop).toEqual({ received: 0, closed: 0, overdue: 1 })
    expect(m.criticalAlerts).toEqual(['SLA incumplido en ARCOP-0003. Se sugiere abrir una autodenuncia.', 'ARCOP-0003 vencida hace 2 d'])
    expect(m.overdueAgreements.map((a) => a.id)).toEqual(['ACU-003', 'ACU-004'])
    expect(m.nextSteps).toBeNull()
  })

  it('para Legal la minuta omite las alertas', () => {
    expect(minuta(after(8), { includeAlerts: false }).criticalAlerts).toEqual([])
  })

  it('sin pendientes una categoría dice "Sin pendientes"', () => {
    const m = minuta(createInitialState(), { includeAlerts: true })
    expect(m.categories.find((c) => c.category === 'Terceros')!.summary).toBe('Sin pendientes')
    expect(m.criticalAlerts).toEqual([])
  })

  it('Generar minuta registra la fecha de la última minuta, que lee el Dashboard', () => {
    const s = after(8)
    expect(dashboardKpis(s).reporte.lastMinutaAt).toBeNull()
    const next = reducer(s, { type: 'minuta' })
    expect(next.data.lastMinutaAt).toBe(s.clock)
    expect(dashboardKpis(next).reporte.lastMinutaAt).toBe(s.clock)
    expect(report1(next).at(-1)!.rows[0]!.indicator).toBe('Última minuta: 03/02/2027')
    expect(next.log.at(-1)).toMatchObject({ entity: 'Reportería', action: 'Generó la minuta mensual (Febrero 2027)' })
    expect(generateMinuta(s).data.lastMinutaAt).toBe(s.clock)
  })

  it('las funciones no mutan el estado de entrada', () => {
    const s: DemoState = after(8)
    const snap = JSON.stringify(s)
    minuta(s, { includeAlerts: true })
    report1(s); report2(s, 'mes'); report3(s, 'mes'); report4(s)
    expect(JSON.stringify(s)).toBe(snap)
  })
})
