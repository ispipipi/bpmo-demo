import type { DemoState, Finding, Mpi } from '../types'

/** % de ítems que cumplen; "No aplica" no cuenta en el denominador. Null si no hay ítems aplicables. */
export function mpiCompliancePct(mpi: Mpi): number | null {
  const applicable = mpi.items.filter((i) => i.state !== 'No aplica')
  if (applicable.length === 0) return null
  return Math.round((applicable.filter((i) => i.state === 'Cumple').length / applicable.length) * 100)
}

export const isFindingOpen = (f: Finding): boolean => f.stage !== 'Cerrado'

/** Hallazgos sin gravedad (aún no evaluados) cuentan como "otro caso abierto". */
export const openFindings = (s: DemoState): Finding[] => s.data.findings.filter(isFindingOpen)
