import { describe, expect, it } from 'vitest'
import { applyNextEvent } from './events'
import { estadoCounts, mapCsvRows, mapSections, matchesFilters, processMap, type MapFilters } from './derive/map'
import { createInitialState } from './seed'

const ALL: MapFilters = { category: 'todas', responsible: 'todos', estado: 'todos' }
const final = () => {
  let s = createInitialState()
  for (let i = 0; i < 8; i++) s = applyNextEvent(s).state
  return s
}

describe('Mapa de procesos (AC-21)', () => {
  it('lista los 22 procesos, 10 incluidos y 12 deshabilitados, agrupados en las categorías con filas', () => {
    const s = createInitialState()
    const rows = processMap(s)
    expect(rows).toHaveLength(22)
    expect(rows.filter((r) => r.included)).toHaveLength(10)
    expect(mapSections(s, ALL).map((x) => x.rows.length)).toEqual([4, 3, 5, 1, 4, 4, 1])
    expect(mapSections(s, ALL).map((x) => x.includedCount)).toEqual([3, 1, 3, 1, 1, 1, 0])
  })

  it('tras los 8 eventos los conteos del segmented coinciden con el mockup: Rojo 5, Amarillo 4, Verde 0, No incluido 12', () => {
    const rows = processMap(final())
    expect(estadoCounts(rows, ALL)).toEqual({ todos: 22, crit: 5, warn: 4, ok: 0, info: 1, na: 12 })
  })

  it('filtra por categoría, responsable y estado; los conteos respetan los otros filtros', () => {
    const rows = processMap(final())
    const f: MapFilters = { category: 'Terceros', responsible: 'H2D', estado: 'crit' }
    expect(rows.filter((r) => matchesFilters(r, f)).map((r) => r.def.id)).toEqual(['P10'])
    expect(estadoCounts(rows, { ...f, category: 'Atención a titulares y a la autoridad' }).todos).toBe(2)
    expect(mapSections(createInitialState(), { ...ALL, estado: 'na' }).every((x) => x.rows.every((r) => !r.included))).toBe(true)
  })

  it('el CSV refleja exactamente las filas visibles y rotula los no incluidos', () => {
    const s = final()
    const visible = processMap(s).filter((r) => matchesFilters(r, { ...ALL, category: 'Cultura' }))
    expect(mapCsvRows(visible)).toEqual([
      ['P12', 'Gestión del cambio', 'Cultura', 'Semestral, más inducción a nuevo personal', 'H2D', 'Registro de asistencia y material entregado', 'No incluido en este demo'],
    ])
    const p9 = processMap(s).filter((r) => r.def.id === 'P9')
    expect(mapCsvRows(p9)[0]?.[6]).toBe('2 acuerdos vencidos')
  })
})
