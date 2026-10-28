import { describe, expect, it } from 'vitest'
import { CATALOG, CATEGORIES, isIncluded } from './catalog'
import { categoryStatus, processStatus } from './derive/tones'
import { applyNextEvent } from './events'
import { createInitialState } from './seed'

function after(n: number) {
  let s = createInitialState()
  for (let i = 0; i < n; i++) s = applyNextEvent(s).state
  return s
}

describe('estado con etiqueta de cada proceso y categoría', () => {
  it('D0: etiquetas del seed', () => {
    const s = after(0)
    expect(processStatus('P1', s)).toEqual({ tone: 'ok', label: 'En plazo' })
    expect(processStatus('P20', s)).toEqual({ tone: 'warn', label: 'En progreso' })
    expect(processStatus('P19', s)).toEqual({ tone: 'ok', label: 'Sin casos abiertos' })
    expect(processStatus('P11', s)).toEqual({ tone: 'warn', label: 'Sin evaluar' })
    expect(processStatus('P8', s)).toEqual({ tone: 'warn', label: 'Por validar' })
    expect(processStatus('P10', s)).toEqual({ tone: 'warn', label: 'Por vencer' })
  })

  it('D0+22 con los 8 eventos: etiquetas del estado final guionado', () => {
    const s = after(8)
    expect(processStatus('P1', s)).toEqual({ tone: 'crit', label: 'Vencido' })
    expect(processStatus('P6b', s)).toEqual({ tone: 'crit', label: 'Fuera de plazo' })
    expect(processStatus('P17', s)).toEqual({ tone: 'crit', label: 'Sin DPA' })
    expect(processStatus('P10', s)).toEqual({ tone: 'crit', label: 'Sin DPA' })
    expect(processStatus('P9', s)).toEqual({ tone: 'crit', label: '2 acuerdos vencidos' })
    expect(processStatus('P19', s)).toEqual({ tone: 'warn', label: 'Caso abierto' })
    expect(processStatus('P4', s)).toEqual({ tone: 'info', label: 'Informativo' })
  })

  it('P17 distingue la falta de garantía cuando el proveedor sí tiene DPA', () => {
    const s = after(5)
    const vendors = s.data.vendors.map((v) => (v.name === 'Proveedor Hosting K' ? { ...v, dpa: 'Vigente' as const } : v))
    expect(processStatus('P17', { ...s, data: { ...s.data, vendors } })).toEqual({ tone: 'crit', label: 'Sin garantía' })
  })

  it('los procesos no incluidos devuelven "No incluido" sin semáforo', () => {
    for (const p of CATALOG.filter((x) => !isIncluded(x))) expect(processStatus(p.id, after(0))).toEqual({ tone: 'na', label: 'No incluido' })
  })

  it('categorías: Terceros crítico, Riesgo por completar, Cultura sin procesos', () => {
    const s = after(8)
    expect(categoryStatus('Terceros', s)).toEqual({ tone: 'crit', label: 'Crítico' })
    expect(categoryStatus('Atención a titulares y a la autoridad', s)).toEqual({ tone: 'crit', label: 'Vencido' })
    expect(categoryStatus('Gestión de riesgo y proyectos', s)).toEqual({ tone: 'warn', label: 'Por completar' })
    expect(categoryStatus('Reporte y mejora continua', s)).toEqual({ tone: 'info', label: 'Informativo' })
    expect(categoryStatus('Cultura', s)).toEqual({ tone: 'na', label: 'Sin procesos incluidos' })
    expect(CATEGORIES).toHaveLength(7)
  })
})
