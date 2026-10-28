export const SIMULATED_LEGEND = 'Datos simulados — demo'

const BOM = '﻿'
const needsQuotes = /[;"\r\n]/

const cell = (v: string): string => (needsQuotes.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

/** CSV en UTF-8 con BOM, separador ';' y fila final con la leyenda de datos simulados (AC-13). */
export function toCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const lines = [header, ...rows, [SIMULATED_LEGEND]].map((r) => r.map(cell).join(';'))
  return BOM + lines.join('\r\n') + '\r\n'
}

export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
