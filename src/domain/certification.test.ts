import { describe, expect, it } from 'vitest'
import { D0 } from '../config'
import { addDays, addYears } from '../lib/dates'
import { applyMpiOp, constanciaBlockers, mpiExpiry, validateItemChange, type MpiOp } from './certification'
import { mpiCompliancePct } from './derive/mpi'
import { processTone } from './derive/tones'
import { createInitialState } from './seed'
import type { DemoState } from './types'

const d = (n: number) => addDays(D0, n)
const run = (s: DemoState, op: MpiOp): DemoState => {
  const r = applyMpiOp(s, op)
  if (!r.ok) throw new Error(r.error)
  return r.value
}
const fail = (s: DemoState, op: MpiOp): string => {
  const r = applyMpiOp(s, op)
  if (r.ok) throw new Error('debía fallar')
  return r.error
}
const item = (s: DemoState, id: string) => s.data.mpi.items.find((i) => i.id === id)!

describe('checklist MPI (MD §6.5.1)', () => {
  it('el seed trae 12 ítems agrupados en 5 grupos con 8 Cumple, 3 En progreso y 1 No aplica', () => {
    const s = createInitialState()
    expect(s.data.mpi.items).toHaveLength(12)
    expect([...new Set(s.data.mpi.items.map((i) => i.group))]).toHaveLength(5)
    expect(mpiCompliancePct(s.data.mpi)).toBe(73)
    expect(item(s, 'MPI-12')).toMatchObject({ state: 'No aplica', justification: expect.stringContaining('Primera certificación') })
  })

  it('"Cumple" exige referencia de evidencia y registra fecha de demo; sube el %', () => {
    const s = createInitialState()
    expect(fail(s, { kind: 'item', itemId: 'MPI-06', state: 'Cumple', evidenceRef: '  ' })).toContain('referencia de evidencia')
    const next = run(s, { kind: 'item', itemId: 'MPI-06', state: 'Cumple', evidenceRef: 'evaluacion_proveedores_2026.xlsx' })
    expect(item(next, 'MPI-06')).toMatchObject({ state: 'Cumple', evidenceRef: 'evaluacion_proveedores_2026.xlsx', date: D0 })
    expect(mpiCompliancePct(next.data.mpi)).toBe(82)
    expect(next.data.mpi.history.at(-1)?.text).toBe('MPI-06: En progreso → Cumple')
  })

  it('"No aplica" exige justificación y sale del denominador', () => {
    const s = createInitialState()
    expect(fail(s, { kind: 'item', itemId: 'MPI-06', state: 'No aplica' })).toContain('justificación')
    const next = run(s, { kind: 'item', itemId: 'MPI-06', state: 'No aplica', justification: 'No se contratan proveedores que traten datos.' })
    expect(mpiCompliancePct(next.data.mpi)).toBe(80)
  })

  it('valida la fecha del ítem y limpia evidencia al salir de Cumple', () => {
    const s = createInitialState()
    expect(validateItemChange(s, { state: 'Cumple', evidenceRef: 'x.pdf', date: d(1) }).date).toContain('posterior')
    expect(validateItemChange(s, { state: 'Cumple', evidenceRef: 'x.pdf', date: 'hoy' }).date).toContain('fecha válida')
    const back = run(s, { kind: 'item', itemId: 'MPI-01', state: 'En progreso' })
    expect(item(back, 'MPI-01')).toMatchObject({ evidenceRef: null, date: null })
    expect(fail(s, { kind: 'item', itemId: 'MPI-06', state: 'En progreso' })).toContain('ya está en ese estado')
    expect(fail(s, { kind: 'item', itemId: 'MPI-99', state: 'Cumple', evidenceRef: 'x' })).toContain('No existe')
  })

  it('un ítem "No cumple" deja el proceso en rojo; "Ver ítems críticos" son los No cumple', () => {
    const s = run(createInitialState(), { kind: 'item', itemId: 'MPI-08', state: 'No cumple' })
    expect(processTone('P20', s)).toBe('crit')
    expect(s.data.mpi.items.filter((i) => i.state === 'No cumple').map((i) => i.id)).toEqual(['MPI-08'])
  })
})

describe('estado de la certificación y vencimiento a 3 años', () => {
  const requested = (s: DemoState) => run(s, { kind: 'requested', date: D0, ref: 'expediente_mpi_001.pdf' })

  it('Registrar solicitud presentada: En preparación → Solicitada con fecha y expediente', () => {
    const s = requested(createInitialState())
    expect(s.data.mpi).toMatchObject({ status: 'Solicitada', requestedAt: D0, expedienteRef: 'expediente_mpi_001.pdf' })
    expect(fail(s, { kind: 'requested', date: D0, ref: 'otro.pdf' })).toContain('en preparación')
    expect(processTone('P20', s)).toBe('warn')
  })

  it('exige fecha válida y referencia', () => {
    const s = createInitialState()
    expect(fail(s, { kind: 'requested', date: D0, ref: ' ' })).toContain('referencia')
    expect(fail(s, { kind: 'requested', date: d(3), ref: 'x.pdf' })).toContain('posterior')
  })

  it('"Registrar constancia vigente" solo con estado "Solicitada" y dice por qué no antes', () => {
    const s = createInitialState()
    expect(constanciaBlockers(s.data.mpi)).toEqual(['Se habilita con el estado "Solicitada".'])
    expect(fail(s, { kind: 'constancia', date: D0, ref: 'c.pdf' })).toContain('Solicitada')
  })

  it('la constancia deja la certificación Vigente y calcula el vencimiento (constancia + 3 años)', () => {
    const s = run(requested(createInitialState()), { kind: 'constancia', date: D0, ref: 'constancia_mpi.pdf' })
    expect(s.data.mpi).toMatchObject({ status: 'Vigente', constanciaAt: D0, constanciaRef: 'constancia_mpi.pdf' })
    expect(mpiExpiry(s.data.mpi)).toBe('2030-01-12')
    expect(constanciaBlockers(s.data.mpi)).toEqual(['La certificación ya está vigente.'])
  })

  it('la constancia no puede ser anterior a la solicitud', () => {
    const s = { ...createInitialState(), clock: d(5) }
    const asked = run(s, { kind: 'requested', date: d(3), ref: 'x.pdf' })
    expect(fail(asked, { kind: 'constancia', date: d(2), ref: 'c.pdf' })).toContain('anterior')
  })

  it('con todos los ítems Cumple/No aplica y la certificación Vigente el proceso queda verde', () => {
    let s = createInitialState()
    for (const id of ['MPI-06', 'MPI-08', 'MPI-10']) s = run(s, { kind: 'item', itemId: id, state: 'Cumple', evidenceRef: `${id}.pdf` })
    expect(processTone('P20', s)).toBe('warn')
    s = run(run(s, { kind: 'requested', date: D0, ref: 'e.pdf' }), { kind: 'constancia', date: D0, ref: 'c.pdf' })
    expect(processTone('P20', s)).toBe('ok')
  })

  it('addYears respeta el 29 de febrero', () => {
    expect(addYears('2028-02-29', 3)).toBe('2031-02-28')
    expect(addYears('2028-02-29', 4)).toBe('2032-02-29')
    expect(addYears('2027-01-12', 3)).toBe('2030-01-12')
  })

  it('las operaciones no mutan el estado de entrada', () => {
    const s = createInitialState()
    const snap = JSON.stringify(s)
    run(s, { kind: 'item', itemId: 'MPI-06', state: 'Cumple', evidenceRef: 'x.pdf' })
    expect(JSON.stringify(s)).toBe(snap)
  })
})
