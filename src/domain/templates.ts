import type { ArcopType, Subtask } from './types'

/** Plantilla de subtareas ARCOP (MD §6.3). Igual para todos los tipos de solicitud. */
export const SUBTASK_TEMPLATE: readonly { name: string; responsible: string; external: boolean }[] = [
  { name: 'Verificar identidad del titular', responsible: 'H2D', external: false },
  { name: 'Ubicar datos en sistemas', responsible: 'TI de Sanitor', external: true },
  { name: 'Validación legal', responsible: 'Legal de Sanitor', external: true },
  { name: 'Ejecución por el área responsable', responsible: 'Área responsable de Sanitor', external: true },
  { name: 'Redactar respuesta', responsible: 'H2D', external: false },
]

export function newSubtasks(caseId: string, _type: ArcopType): Subtask[] {
  return SUBTASK_TEMPLATE.map((t, i) => ({
    id: `${caseId}-S${i + 1}`,
    ...t,
    state: 'Pendiente',
    date: null,
    evidenceRef: null,
  }))
}
