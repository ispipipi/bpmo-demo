import { CATALOG, CATEGORIES, isIncluded, type Category, type ProcessDef, type Responsible } from '../catalog'
import type { Tone } from '../tone'
import type { DemoState } from '../types'
import { categoryStatus, processStatus, type CategoryStatus, type ProcessStatus } from './tones'

export type MapRow = { def: ProcessDef; included: boolean; status: ProcessStatus }
export type MapSection = { category: Category; status: CategoryStatus; rows: MapRow[]; includedCount: number; total: number }
export type MapFilters = { category: Category | 'todas'; responsible: Responsible | 'todos'; estado: 'todos' | Tone }

export const processMap = (s: DemoState): MapRow[] =>
  CATALOG.map((def) => ({ def, included: isIncluded(def), status: processStatus(def.id, s) }))

export const matchesFilters = (r: MapRow, f: MapFilters): boolean =>
  (f.category === 'todas' || r.def.category === f.category) &&
  (f.responsible === 'todos' || r.def.responsible === f.responsible) &&
  (f.estado === 'todos' || r.status.tone === f.estado)

/** Conteos por estado sobre las filas que cumplen categoría y responsable (el estado no se filtra a sí mismo). */
export function estadoCounts(rows: readonly MapRow[], f: MapFilters): Record<'todos' | Tone, number> {
  const base = rows.filter((r) => matchesFilters(r, { ...f, estado: 'todos' }))
  const count = (t: Tone) => base.filter((r) => r.status.tone === t).length
  return { todos: base.length, crit: count('crit'), warn: count('warn'), ok: count('ok'), info: count('info'), na: count('na') }
}

export function mapSections(s: DemoState, f: MapFilters): MapSection[] {
  const all = processMap(s)
  return CATEGORIES.map((category) => {
    const inCategory = all.filter((r) => r.def.category === category)
    return {
      category,
      status: categoryStatus(category, s),
      rows: inCategory.filter((r) => matchesFilters(r, f)),
      includedCount: inCategory.filter((r) => r.included).length,
      total: inCategory.length,
    }
  }).filter((sec) => sec.rows.length > 0)
}

export const MAP_CSV_HEADER = ['N°', 'Proceso', 'Categoría', 'Periodicidad / gatillo', 'Responsable', 'Evidencia requerida', 'Estado'] as const

export const mapCsvRows = (rows: readonly MapRow[]): string[][] =>
  rows.map((r) => [r.def.id, r.def.name, r.def.category, r.def.trigger, r.def.responsible, r.def.evidence, r.included ? r.status.label : 'No incluido en este demo'])
