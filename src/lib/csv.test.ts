import { describe, expect, it } from 'vitest'
import { SIMULATED_LEGEND, toCsv } from './csv'

describe('toCsv (AC-13)', () => {
  it('empieza con BOM UTF-8, usa ";" y CRLF, y cierra con la leyenda de datos simulados', () => {
    const csv = toCsv(['N°', 'Proceso'], [['P1', 'Gestión de requerimientos ARCOP']])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.slice(1)).toBe(`N°;Proceso\r\nP1;Gestión de requerimientos ARCOP\r\n${SIMULATED_LEGEND}\r\n`)
  })

  it('cita celdas con ";", comillas o saltos de línea', () => {
    const csv = toCsv(['a'], [['x;y'], ['di "hola"'], ['l1\nl2']])
    expect(csv).toContain('"x;y"')
    expect(csv).toContain('"di ""hola"""')
    expect(csv).toContain('"l1\nl2"')
  })

  it('sin filas igual incluye la leyenda', () => {
    expect(toCsv(['a'], []).trim().endsWith(SIMULATED_LEGEND)).toBe(true)
  })
})
