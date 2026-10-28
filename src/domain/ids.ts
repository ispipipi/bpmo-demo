/** Siguiente id con el formato PREFIJO-0001 a partir del mayor existente. */
export function nextId(prefix: string, ids: readonly string[], width: number): string {
  const max = ids.reduce((m, id) => Math.max(m, Number(id.slice(prefix.length + 1)) || 0), 0)
  return `${prefix}-${String(max + 1).padStart(width, '0')}`
}
