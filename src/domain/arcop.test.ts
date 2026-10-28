import { describe, expect, it } from 'vitest'
import { D0 } from '../config'
import { addDays } from '../lib/dates'
import { applyArcopOp, closeBlockers, possibleDuplicate, responseTemplate, type ArcopOp } from './arcop'
import { arcopView, arcopViews } from './derive/arcop'
import { arcopClosedInTime, arcopDue, arcopTone } from './derive/sla'
import { applyNextEvent } from './events'
import { createInitialState } from './seed'
import type { ArcopRequest, DemoState } from './types'

const d = (n: number) => addDays(D0, n)
const get = (s: DemoState, id: string): ArcopRequest => {
  const r = s.data.arcop.find((x) => x.id === id)
  if (!r) throw new Error(id)
  return r
}
const run = (s: DemoState, op: ArcopOp): DemoState => {
  const r = applyArcopOp(s, op)
  if (!r.ok) throw new Error(r.error)
  return r.value
}
const fail = (s: DemoState, op: ArcopOp): string => {
  const r = applyArcopOp(s, op)
  if (r.ok) throw new Error('debía fallar')
  return r.error
}
const after = (n: number) => {
  let s = createInitialState()
  for (let i = 0; i < n; i++) s = applyNextEvent(s).state
  return s
}
const completeAll = (s: DemoState, id: string): DemoState =>
  get(s, id).subtasks.reduce((acc, t) => (t.state === 'Completa' ? acc : run(acc, { kind: 'subtask', id, subtaskId: t.id, state: 'Completa', evidenceRef: 'ev.pdf' })), s)

describe('asignar analista', () => {
  it('asigna, pasa Nueva → En gestión y registra en historial y bitácora', () => {
    const s = createInitialState()
    const next = run(s, { kind: 'assign', id: 'ARCOP-0007', analyst: 'Analista Demo 2' })
    expect(get(next, 'ARCOP-0007')).toMatchObject({ analyst: 'Analista Demo 2', status: 'En gestión' })
    expect(get(next, 'ARCOP-0007').history.at(-1)?.text).toBe('Caso asignado a Analista Demo 2')
    expect(next.log.at(-1)).toMatchObject({ entity: 'ARCOP-0007', action: 'Asignó Analista Demo 2' })
  })

  it('reasigna, y rechaza el mismo analista, un nombre desconocido y casos cerrados', () => {
    const s = createInitialState()
    const re = run(s, { kind: 'assign', id: 'ARCOP-0003', analyst: 'Analista Demo 3' })
    expect(get(re, 'ARCOP-0003').history.at(-1)?.text).toBe('Caso reasignado de Analista Demo 1 a Analista Demo 3')
    expect(fail(s, { kind: 'assign', id: 'ARCOP-0003', analyst: 'Analista Demo 1' })).toContain('ya está asignado')
    expect(fail(s, { kind: 'assign', id: 'ARCOP-0003', analyst: 'Otro' })).toContain('Elige un analista')
    expect(fail(s, { kind: 'assign', id: 'ARCOP-0001', analyst: 'Analista Demo 2' })).toBe('El caso ya está cerrado.')
  })
})

describe('subtareas', () => {
  it('Completa registra fecha de demo y la referencia opcional; volver atrás las limpia', () => {
    const s = createInitialState()
    const t = get(s, 'ARCOP-0003').subtasks[2]!
    const done = run(s, { kind: 'subtask', id: 'ARCOP-0003', subtaskId: t.id, state: 'Completa', evidenceRef: ' vb_legal.pdf ' })
    const doneT = get(done, 'ARCOP-0003').subtasks[2]!
    expect(doneT).toMatchObject({ state: 'Completa', date: D0, evidenceRef: 'vb_legal.pdf' })
    const sinRef = run(s, { kind: 'subtask', id: 'ARCOP-0003', subtaskId: t.id, state: 'Completa' })
    expect(get(sinRef, 'ARCOP-0003').subtasks[2]?.evidenceRef).toBeNull()
    const back = run(done, { kind: 'subtask', id: 'ARCOP-0003', subtaskId: t.id, state: 'En curso' })
    expect(get(back, 'ARCOP-0003').subtasks[2]).toMatchObject({ state: 'En curso', date: null, evidenceRef: null })
  })

  it('una subtarea en una solicitud Nueva la pasa a En gestión; el mismo estado es un error', () => {
    const s = createInitialState()
    const t = get(s, 'ARCOP-0007').subtasks[0]!
    expect(get(run(s, { kind: 'subtask', id: 'ARCOP-0007', subtaskId: t.id, state: 'En curso' }), 'ARCOP-0007').status).toBe('En gestión')
    expect(fail(s, { kind: 'subtask', id: 'ARCOP-0007', subtaskId: t.id, state: 'Pendiente' })).toContain('ya está en ese estado')
  })

  it('reabrir una subtarea de un caso con respuesta lista lo devuelve a En gestión', () => {
    const s = createInitialState()
    const t = get(s, 'ARCOP-0005').subtasks[0]!
    expect(get(s, 'ARCOP-0005').status).toBe('Respuesta lista')
    expect(get(run(s, { kind: 'subtask', id: 'ARCOP-0005', subtaskId: t.id, state: 'En curso' }), 'ARCOP-0005').status).toBe('En gestión')
  })
})

describe('recordatorios simulados', () => {
  it('solo por subtareas no completas de un área de Sanitaria Valparaíso, y quedan en el historial del caso', () => {
    const s = createInitialState()
    const legal = get(s, 'ARCOP-0003').subtasks[2]!
    const next = run(s, { kind: 'reminder', id: 'ARCOP-0003', subtaskId: legal.id })
    expect(get(next, 'ARCOP-0003').history.at(-1)?.text).toBe('Recordatorio simulado enviado a Legal de Sanitaria Valparaíso por "Validación legal"')
    const h2d = get(s, 'ARCOP-0003').subtasks[4]!
    expect(fail(s, { kind: 'reminder', id: 'ARCOP-0003', subtaskId: h2d.id })).toContain('Solo se envían recordatorios')
    const done = get(s, 'ARCOP-0003').subtasks[0]!
    expect(fail(s, { kind: 'reminder', id: 'ARCOP-0003', subtaskId: done.id })).toContain('Solo se envían recordatorios')
  })
})

describe('prórroga', () => {
  it('suma los días del parámetro, recalcula el semáforo y registra el nuevo vencimiento', () => {
    const s = after(7)
    expect(arcopTone(get(s, 'ARCOP-0003'), s)).toBe('crit')
    const next = run(s, { kind: 'extension', id: 'ARCOP-0003', reason: 'Se requiere más tiempo para ubicar los datos.' })
    expect(arcopDue(get(next, 'ARCOP-0003'), next.params)).toBe(d(50))
    expect(arcopTone(get(next, 'ARCOP-0003'), next)).toBe('ok')
    expect(get(next, 'ARCOP-0003').history.at(-1)?.text).toBe('Prórroga registrada: +30 días, nuevo vencimiento 03/03/2027')
  })

  it('exige motivo de al menos 10 caracteres y no admite una segunda prórroga', () => {
    const s = createInitialState()
    expect(fail(s, { kind: 'extension', id: 'ARCOP-0003', reason: 'corto' })).toContain('al menos 10')
    expect(fail(s, { kind: 'extension', id: 'ARCOP-0003', reason: '         ' })).toContain('al menos 10')
    expect(fail(s, { kind: 'extension', id: 'ARCOP-0004', reason: 'Otra prórroga de prueba' })).toContain('ya tiene una prórroga')
  })
})

describe('respuesta y cierre (AC-05)', () => {
  it('la respuesta vacía es un error en línea; en una solicitud Nueva se pide asignar antes', () => {
    const s = createInitialState()
    expect(fail(s, { kind: 'response', id: 'ARCOP-0003', text: '   ' })).toBe('La respuesta no puede estar vacía.')
    expect(fail(s, { kind: 'response', id: 'ARCOP-0007', text: 'texto' })).toContain('Asigna un analista')
  })

  it('con subtareas pendientes guarda la respuesta pero el caso sigue En gestión', () => {
    const s = run(createInitialState(), { kind: 'response', id: 'ARCOP-0003', text: 'Respuesta preparada' })
    expect(get(s, 'ARCOP-0003')).toMatchObject({ status: 'En gestión', response: 'Respuesta preparada' })
  })

  it('pasa a Respuesta lista solo con todas las subtareas completas y respuesta no vacía', () => {
    const base = run(createInitialState(), { kind: 'response', id: 'ARCOP-0003', text: 'Respuesta preparada' })
    const done = completeAll(base, 'ARCOP-0003')
    expect(get(done, 'ARCOP-0003').status).toBe('Respuesta lista')
    const otherOrder = run(completeAll(createInitialState(), 'ARCOP-0003'), { kind: 'response', id: 'ARCOP-0003', text: 'Respuesta preparada' })
    expect(get(otherOrder, 'ARCOP-0003').status).toBe('Respuesta lista')
  })

  it('Cerrar caso está bloqueado y dice qué falta; cerrado en plazo queda registrado', () => {
    const s = createInitialState()
    expect(closeBlockers(get(s, 'ARCOP-0003'))).toEqual(['Faltan 3 de 5 subtareas por completar.', 'Falta redactar la respuesta.'])
    expect(fail(s, { kind: 'close', id: 'ARCOP-0003' })).toContain('Faltan 3 de 5')
    const ready = completeAll(run(s, { kind: 'response', id: 'ARCOP-0003', text: 'Respuesta preparada' }), 'ARCOP-0003')
    expect(closeBlockers(get(ready, 'ARCOP-0003'))).toEqual([])
    const closed = run(ready, { kind: 'close', id: 'ARCOP-0003' })
    expect(get(closed, 'ARCOP-0003')).toMatchObject({ status: 'Cerrada', resolution: 'Respondida', closedAt: D0 })
    expect(get(closed, 'ARCOP-0003').history.at(-1)?.text).toBe('Caso cerrado dentro de plazo')
    expect(arcopView(get(closed, 'ARCOP-0003'), closed).closed).toEqual({ tone: 'ok', label: 'Cerrada en plazo' })
  })

  it('un caso vencido que se cierra queda registrado como cerrado fuera de plazo', () => {
    const s = after(7)
    const ready = completeAll(run(s, { kind: 'response', id: 'ARCOP-0003', text: 'Respuesta tardía' }), 'ARCOP-0003')
    const closed = run(ready, { kind: 'close', id: 'ARCOP-0003' })
    expect(get(closed, 'ARCOP-0003').history.at(-1)?.text).toBe('Caso cerrado fuera de plazo')
    expect(arcopClosedInTime(get(closed, 'ARCOP-0003'), closed.params)).toBe(false)
    expect(arcopView(get(closed, 'ARCOP-0003'), closed).closed?.label).toBe('Cerrada fuera de plazo')
  })

  it('ARCOP-0005 (respuesta lista) se puede cerrar; un caso cerrado no admite más acciones', () => {
    const closed = run(createInitialState(), { kind: 'close', id: 'ARCOP-0005' })
    expect(get(closed, 'ARCOP-0005').status).toBe('Cerrada')
    expect(fail(closed, { kind: 'close', id: 'ARCOP-0005' })).toBe('El caso ya está cerrado.')
    expect(fail(closed, { kind: 'extension', id: 'ARCOP-0005', reason: 'Motivo suficientemente largo' })).toBe('El caso ya está cerrado.')
  })
})

describe('rechazo como improcedente', () => {
  it('exige fundamento de al menos 20 caracteres y cierra con el fundamento', () => {
    const s = createInitialState()
    expect(fail(s, { kind: 'reject', id: 'ARCOP-0007', ground: 'muy corto' })).toContain('al menos 20')
    const next = run(s, { kind: 'reject', id: 'ARCOP-0007', ground: 'El titular no acreditó su identidad.' })
    expect(get(next, 'ARCOP-0007')).toMatchObject({ status: 'Cerrada', resolution: 'Improcedente', rejectionGround: 'El titular no acreditó su identidad.' })
    expect(arcopView(get(next, 'ARCOP-0007'), next).closed).toEqual({ tone: 'info', label: 'Improcedente' })
  })

  it('una improcedente no cuenta en el % cerradas dentro de plazo', () => {
    const next = run(createInitialState(), { kind: 'reject', id: 'ARCOP-0007', ground: 'El titular no acreditó su identidad.' })
    expect(next.data.arcop.filter((r) => r.resolution === 'Improcedente')).toHaveLength(2)
  })
})

describe('lista, duplicados y plantillas', () => {
  it('orden por defecto: Rojo → Amarillo → Verde por días restantes, y cerradas al final', () => {
    const s = after(3)
    const ids = arcopViews(s).map((v) => v.req.id)
    expect(ids[0]).toBe('ARCOP-0003')
    const firstClosed = arcopViews(s).findIndex((v) => !v.open)
    expect(arcopViews(s).slice(0, firstClosed).every((v) => v.open)).toBe(true)
    expect(arcopViews(s).slice(firstClosed).every((v) => !v.open)).toBe(true)
    const lefts = arcopViews(s).slice(1, firstClosed).map((v) => v.daysLeft!)
    expect(lefts).toEqual([...lefts].sort((a, b) => a - b))
  })

  it('detecta un posible duplicado del mismo titular y tipo sin bloquear', () => {
    const s = createInitialState()
    const dup: ArcopRequest = { ...get(s, 'ARCOP-0003'), id: 'ARCOP-0099' }
    const withDup: DemoState = { ...s, data: { ...s.data, arcop: [...s.data.arcop, dup] } }
    expect(possibleDuplicate(withDup, dup)?.id).toBe('ARCOP-0003')
    expect(possibleDuplicate(s, get(s, 'ARCOP-0003'))).toBeUndefined()
  })

  it('la plantilla de respuesta depende del tipo y menciona al titular', () => {
    const t = responseTemplate('Supresión', 'Titular Demo 04')
    expect(t).toContain('Titular Demo 04')
    expect(t).toContain('suprimido')
    expect(responseTemplate('Acceso', 'X')).not.toBe(responseTemplate('Oposición', 'X'))
  })

  it('las operaciones no mutan el estado de entrada', () => {
    const s = createInitialState()
    const snap = JSON.stringify(s)
    run(s, { kind: 'assign', id: 'ARCOP-0007', analyst: 'Analista Demo 1' })
    expect(JSON.stringify(s)).toBe(snap)
  })
})

describe('reducer', () => {
  it('ignora operaciones inválidas sin cambiar el estado', async () => {
    const { reducer } = await import('../store/reducer')
    const s = createInitialState()
    expect(reducer(s, { type: 'arcop', op: { kind: 'close', id: 'ARCOP-0003' } })).toBe(s)
    expect(reducer(s, { type: 'arcop', op: { kind: 'assign', id: 'ARCOP-0007', analyst: 'Analista Demo 1' } }).log).toHaveLength(1)
  })
})
