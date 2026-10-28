import { describe, expect, it } from 'vitest'
import { D0 } from '../config'
import { addDays } from '../lib/dates'
import { allAlerts } from './derive/alerts'
import { processTone } from './derive/tones'
import { applyNextEvent } from './events'
import { advanceBlockers, applyFindingOp, canRetreat, PACKAGE_NOTICE, validateEvaluation, validateSignoff, type FindingOp } from './finding'
import { createInitialState } from './seed'
import type { DemoState, Finding } from './types'

const d = (n: number) => addDays(D0, n)
const run = (s: DemoState, op: FindingOp): DemoState => {
  const r = applyFindingOp(s, op)
  if (!r.ok) throw new Error(r.error)
  return r.value
}
const fail = (s: DemoState, op: FindingOp): string => {
  const r = applyFindingOp(s, op)
  if (r.ok) throw new Error('debía fallar')
  return r.error
}
const f = (s: DemoState, id: string): Finding => s.data.findings.find((x) => x.id === id)!
const withE8 = () => {
  let s = createInitialState()
  for (let i = 0; i < 8; i++) s = applyNextEvent(s).state
  return s
}
const EVAL = { severity: 'Media' as const, affectedData: 'Nombre y correo', holdersEstimate: '320', cause: 'Permisos heredados.' }
const SIGN = { by: 'DPD de Sanitor', date: D0, ref: 'APR-002.pdf' }

/** Lleva HAL-0002 (creado por E8) hasta la etapa pedida cumpliendo cada condición. */
function upTo(stage: Finding['stage'], base = withE8()): DemoState {
  const id = 'HAL-0002'
  let s = base
  const steps: [Finding['stage'], (x: DemoState) => DemoState][] = [
    ['Detectado', (x) => run(x, { kind: 'advance', id })],
    ['En evaluación', (x) => run(run(x, { kind: 'evaluate', id, ...EVAL }), { kind: 'advance', id })],
    ['Plan de corrección', (x) => run(run(x, { kind: 'planAdd', id, action: 'Restringir el acceso', owner: 'TI de Sanitor', dueAt: d(30) }), { kind: 'advance', id })],
    ['Aprobación interna', (x) => run(run(x, { kind: 'approve', id, ...SIGN }), { kind: 'advance', id })],
    ['Paquete listo', (x) => run(run(x, { kind: 'package', id }), { kind: 'advance', id })],
    ['Presentada', (x) => run(run(x, { kind: 'file', id, ...SIGN }), { kind: 'advance', id })],
  ]
  for (const [from, go] of steps) {
    if (f(s, id).stage === stage) break
    if (f(s, id).stage === from) s = go(s)
  }
  return s
}

describe('crear hallazgo', () => {
  it('manual: exige descripción de al menos 10 caracteres y queda en Detectado', () => {
    const s = createInitialState()
    expect(fail(s, { kind: 'create', origin: 'Manual', originRef: null, description: 'corta' })).toContain('al menos 10')
    const next = run(s, { kind: 'create', origin: 'Manual', originRef: null, description: 'Planilla de clientes sin restricción de acceso.' })
    expect(f(next, 'HAL-0002')).toMatchObject({ stage: 'Detectado', origin: 'Manual', severity: null })
    expect(next.log.at(-1)?.entity).toBe('HAL-0002')
  })

  it('desde un ítem MPI que no cumple, hereda la referencia del ítem', () => {
    const next = run(createInitialState(), { kind: 'create', origin: 'Ítem MPI', originRef: 'MPI-08', description: 'MPI-08 no cumple: falta el protocolo de brechas.' })
    expect(f(next, 'HAL-0002')).toMatchObject({ origin: 'Ítem MPI', originRef: 'MPI-08' })
  })

  it('el hallazgo de E8 hereda la descripción del evento y deja el flujo disponible', () => {
    const s = withE8()
    expect(f(s, 'HAL-0002').description).toContain('ubicación no declarada en el RAT')
    expect(advanceBlockers(f(s, 'HAL-0002'))).toEqual([])
  })
})

describe('etapas y condiciones de avance (AC-08)', () => {
  it('no avanza de En evaluación sin la evaluación completa y dice qué falta', () => {
    const s = upTo('En evaluación')
    expect(f(s, 'HAL-0002').stage).toBe('En evaluación')
    expect(advanceBlockers(f(s, 'HAL-0002'))).toEqual(['Completa la evaluación: falta gravedad, datos afectados, cantidad estimada de titulares, causa.'])
    expect(fail(s, { kind: 'advance', id: 'HAL-0002' })).toContain('falta gravedad')
    const partial = run(s, { kind: 'evaluate', id: 'HAL-0002', ...EVAL })
    expect(advanceBlockers(f(partial, 'HAL-0002'))).toEqual([])
  })

  it('valida la evaluación campo por campo', () => {
    expect(Object.keys(validateEvaluation({ severity: '', affectedData: ' ', holdersEstimate: '-1', cause: '' })).sort()).toEqual(['affectedData', 'cause', 'holdersEstimate', 'severity'])
    expect(validateEvaluation({ severity: 'Alta', affectedData: 'x', holdersEstimate: '0', cause: 'y' })).toEqual({})
    expect(validateEvaluation({ severity: 'Alta', affectedData: 'x', holdersEstimate: '1.5', cause: 'y' }).holdersEstimate).toBeDefined()
  })

  it('al completar la evaluación y avanzar se genera el acta con la fecha de demo', () => {
    const s = upTo('Plan de corrección')
    expect(f(s, 'HAL-0002')).toMatchObject({ stage: 'Plan de corrección', evaluatedAt: d(22), severity: 'Media', holdersEstimate: 320 })
    expect(f(s, 'HAL-0002').history.at(-1)?.text).toContain('Acta de evaluación generada')
  })

  it('el plan sin acciones no avanza; con una acción sí; las acciones se pueden quitar', () => {
    const s = run(upTo('Plan de corrección'), { kind: 'planAdd', id: 'HAL-0002', action: 'Restringir el acceso', owner: 'TI de Sanitor', dueAt: d(30) })
    const base = run(s, { kind: 'planRemove', id: 'HAL-0002', actionId: 'HAL-0002-A1' })
    expect(advanceBlockers(f(base, 'HAL-0002'))).toEqual(['Agrega al menos una acción al plan de corrección.'])
    expect(fail(base, { kind: 'advance', id: 'HAL-0002' })).toContain('al menos una acción')
    expect(fail(base, { kind: 'planAdd', id: 'HAL-0002', action: '', owner: '', dueAt: '' })).toBeDefined()
    const again = run(base, { kind: 'planAdd', id: 'HAL-0002', action: 'Otra acción', owner: 'TI de Sanitor', dueAt: d(40) })
    expect(f(again, 'HAL-0002').plan[0]?.id).toBe('HAL-0002-A1')
  })

  it('no avanza de Aprobación interna sin la aprobación registrada (quién, fecha y referencia)', () => {
    const s = upTo('Aprobación interna')
    expect(fail(s, { kind: 'advance', id: 'HAL-0002' })).toContain('aprobación interna')
    expect(fail(s, { kind: 'approve', id: 'HAL-0002', by: '', date: D0, ref: 'x' })).toBeDefined()
    expect(Object.keys(validateSignoff(s, { by: '', date: d(60), ref: ' ' })).sort()).toEqual(['by', 'date', 'ref'])
  })

  it('Paquete listo exige generar el paquete', () => {
    const s = upTo('Paquete listo')
    expect(fail(s, { kind: 'advance', id: 'HAL-0002' })).toContain('Genera el paquete')
    const next = run(s, { kind: 'package', id: 'HAL-0002' })
    expect(f(next, 'HAL-0002').packageGeneratedAt).toBe(d(22))
    expect(PACKAGE_NOTICE).toContain('quien ejerce como DPD formal')
  })

  it('Presentada exige la constancia con los tres campos (AC-09)', () => {
    const s = upTo('Presentada')
    expect(f(s, 'HAL-0002').stage).toBe('Presentada')
    expect(fail(s, { kind: 'advance', id: 'HAL-0002' })).toContain('constancia de presentación')
    for (const bad of [{ by: '', date: D0, ref: 'r.pdf' }, { by: 'DPD', date: '', ref: 'r.pdf' }, { by: 'DPD', date: D0, ref: '' }]) {
      expect(fail(s, { kind: 'file', id: 'HAL-0002', ...bad })).toBeDefined()
    }
    const filed = run(s, { kind: 'file', id: 'HAL-0002', ...SIGN })
    expect(f(filed, 'HAL-0002').filing).toEqual({ by: 'DPD de Sanitor', date: D0, ref: 'APR-002.pdf' })
    expect(f(run(filed, { kind: 'advance', id: 'HAL-0002' }), 'HAL-0002').stage).toBe('En seguimiento')
  })

  it('las acciones solo se registran en su etapa', () => {
    const s = upTo('Presentada')
    expect(fail(s, { kind: 'approve', id: 'HAL-0002', ...SIGN })).toContain('Aprobación interna')
    expect(fail(s, { kind: 'evaluate', id: 'HAL-0002', ...EVAL })).toContain('En evaluación')
  })
})

describe('seguimiento y cierre', () => {
  const seguimiento = () => run(run(upTo('Presentada'), { kind: 'file', id: 'HAL-0002', ...SIGN }), { kind: 'advance', id: 'HAL-0002' })

  it('cierra solo con todas las acciones completas y un resultado', () => {
    const s = seguimiento()
    expect(advanceBlockers(f(s, 'HAL-0002'))).toEqual(['Faltan 1 de 1 acciones del plan por completar.'])
    expect(fail(s, { kind: 'close', id: 'HAL-0002', result: 'Sin observaciones' })).toContain('Faltan 1 de 1')
    expect(fail(s, { kind: 'advance', id: 'HAL-0002' })).toContain('Cierra el caso')
    const done = run(s, { kind: 'actionDone', id: 'HAL-0002', actionId: 'HAL-0002-A1', done: true })
    expect(fail(done, { kind: 'close', id: 'HAL-0002', result: '  ' })).toContain('resultado')
    const closed = run(done, { kind: 'close', id: 'HAL-0002', result: 'Plan ejecutado sin observaciones de la Agencia.' })
    expect(f(closed, 'HAL-0002')).toMatchObject({ stage: 'Cerrado', closedAt: d(22), closeResult: 'Plan ejecutado sin observaciones de la Agencia.' })
    expect(processTone('P19', closed)).toBe('ok')
  })

  it('un caso cerrado es de solo lectura', () => {
    const closed = run(run(seguimiento(), { kind: 'actionDone', id: 'HAL-0002', actionId: 'HAL-0002-A1', done: true }), { kind: 'close', id: 'HAL-0002', result: 'Plan ejecutado.' })
    expect(fail(closed, { kind: 'retreat', id: 'HAL-0002', reason: 'Quiero reabrirlo ahora' })).toBeDefined()
    expect(fail(closed, { kind: 'actionDone', id: 'HAL-0002', actionId: 'HAL-0002-A1', done: false })).toContain('cerrado')
    expect(canRetreat(f(closed, 'HAL-0002'))).toBe(false)
  })
})

describe('retroceder etapa', () => {
  it('solo hacia la anterior y con motivo; limpia lo que dependía de la etapa abandonada', () => {
    const s = run(upTo('Paquete listo'), { kind: 'package', id: 'HAL-0002' })
    expect(fail(s, { kind: 'retreat', id: 'HAL-0002', reason: 'corto' })).toContain('al menos 10')
    const back = run(s, { kind: 'retreat', id: 'HAL-0002', reason: 'Se corrige el plan de acciones.' })
    expect(f(back, 'HAL-0002')).toMatchObject({ stage: 'Aprobación interna', packageGeneratedAt: null })
    expect(f(back, 'HAL-0002').approval).not.toBeNull()
    expect(f(back, 'HAL-0002').history.at(-1)?.text).toContain('(retroceso). Motivo: Se corrige el plan de acciones.')
    const back2 = run(back, { kind: 'retreat', id: 'HAL-0002', reason: 'Se vuelve a aprobar el plan.' })
    expect(f(back2, 'HAL-0002')).toMatchObject({ stage: 'Plan de corrección', approval: null })
  })

  it('no existe desde Detectado ni desde Presentada (la constancia ya existe)', () => {
    expect(canRetreat(f(withE8(), 'HAL-0002'))).toBe(false)
    const s = upTo('Presentada')
    expect(canRetreat(f(s, 'HAL-0002'))).toBe(false)
    expect(fail(s, { kind: 'retreat', id: 'HAL-0002', reason: 'Quiero retroceder desde aquí' })).toContain('la constancia ya existe')
  })
})

describe('semáforo y alertas del proceso P19', () => {
  it('abierto sin gravedad es amarillo; con gravedad Alta es rojo y genera alerta Alta', () => {
    const s = withE8()
    expect(processTone('P19', s)).toBe('warn')
    const alta = run(run(s, { kind: 'advance', id: 'HAL-0002' }), { kind: 'evaluate', id: 'HAL-0002', ...EVAL, severity: 'Alta' })
    expect(processTone('P19', alta)).toBe('crit')
    expect(allAlerts(alta).find((a) => a.id === 'regla:autodenuncia-gravedad-alta:HAL-0002')?.severity).toBe('Alta')
  })

  it('las operaciones no mutan el estado de entrada', () => {
    const s = withE8()
    const snap = JSON.stringify(s)
    run(s, { kind: 'advance', id: 'HAL-0002' })
    expect(JSON.stringify(s)).toBe(snap)
  })
})
