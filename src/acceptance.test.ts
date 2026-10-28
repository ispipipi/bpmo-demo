import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { D0 } from './config'
import { CATALOG } from './domain/catalog'
import { allAlerts } from './domain/derive/alerts'
import { dashboardKpis } from './domain/derive/kpis'
import { processTone } from './domain/derive/tones'
import { applyNextEvent } from './domain/events'
import { report1 } from './domain/reports'
import { createInitialState } from './domain/seed'
import { reducer } from './store/reducer'
import type { DemoState } from './domain/types'

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? files(p) : [p]
  })

describe('AC-19: nada de Ticketator y los 12 procesos no incluidos solo viven en el Mapa', () => {
  it('ningún archivo fuente ni el HTML menciona Ticketator', () => {
    const all = [...files('src').filter((f) => !f.endsWith('acceptance.test.ts')), 'index.html']
    expect(all.filter((f) => /ticketator/i.test(readFileSync(f, 'utf8')))).toEqual([])
  })

  it('los procesos no incluidos no tienen ruta ni módulo', () => {
    const notIncluded = CATALOG.filter((p) => p.module === null)
    expect(notIncluded).toHaveLength(12)
    const app = readFileSync('src/App.tsx', 'utf8')
    for (const p of notIncluded) expect(app.toLowerCase()).not.toContain(`/${p.id.toLowerCase()}`)
  })
})

describe('AC-18: lo simulado lo dice', () => {
  it('cada evento guionado que simula una novedad externa termina en "(simulado)"', () => {
    let s = createInitialState()
    for (let i = 0; i < 8; i++) {
      const r = applyNextEvent(s)
      expect(r.message).toMatch(/\(simulado\)$/)
      s = r.state
    }
    expect(applyNextEvent(s).message).toBe('Sin novedades. Todo al día (simulado)')
  })

  it('el estado de Ley de Datos y la hora de sincronización se declaran simulados en la interfaz', () => {
    const src = readFileSync('src/components/LeyDeDatosStatus.tsx', 'utf8')
    expect(src).toContain('(simulado)')
    expect(src).toContain('(simulada)')
  })

  it('los avisos de acciones externas (recordatorios, convocatoria, campaña, registro en RAT) llevan la marca', () => {
    const pages = ['AlertsPage', 'CommitteePage', 'ConsentsPage', 'ArcopDetailPage', 'RatRequestPage', 'VendorsPage'].map((p) => readFileSync(`src/pages/${p}.tsx`, 'utf8')).join('\n')
    for (const needle of ['(simulado)', 'simulada', 'Resultado simulado']) expect(pages).toContain(needle)
    expect(readFileSync('src/pages/CommitteePage.tsx', 'utf8')).toContain('no se envió correo')
  })
})

describe('AC-02 y AC-22: una sola fuente de verdad', () => {
  const cases: [string, DemoState][] = []
  let s = createInitialState()
  cases.push(['D0', s])
  for (let i = 1; i <= 8; i++) {
    s = applyNextEvent(s).state
    cases.push([`tras E${i}`, s])
  }

  it.each(cases)('Dashboard, Mapa e informe 1 coinciden con los registros (%s)', (_, st) => {
    const k = dashboardKpis(st)
    const open = st.data.arcop.filter((r) => r.status !== 'Cerrada').length
    expect(k.atencion.arcopOpen).toBe(open)
    expect(k.registro.activeHolders).toBe(st.data.consents.reduce((n, c) => n + c.active, 0))
    expect(k.terceros.withoutValidDpa).toBe(st.data.vendors.filter((v) => v.dpa !== 'Vigente').length)
    const r1 = report1(st).flatMap((sec) => sec.rows)
    for (const row of r1) expect(row.status.tone).toBe(processTone(row.id, st))
    expect(r1).toHaveLength(10)
  })

  it.each(cases)('el semáforo de cada categoría es el peor de sus procesos incluidos (%s)', (_, st) => {
    const rank = { crit: 3, warn: 2, ok: 1, info: 0, na: 0 } as const
    for (const sec of report1(st)) {
      const worst = sec.rows.map((r) => r.status.tone).reduce((a, b) => (rank[b] > rank[a] ? b : a))
      expect(sec.status.tone).toBe(worst)
    }
  })

  it('las alertas nuevas del menú son exactamente las de la bandeja', () => {
    expect(allAlerts(s).filter((a) => a.status === 'Nueva').length).toBeGreaterThan(0)
  })
})

describe('AC-15: Reiniciar demo devuelve exactamente al estado inicial', () => {
  it('desde cualquier punto del guion, incluidos rol y parámetros', () => {
    let s = reducer(createInitialState(), { type: 'setRole', role: 'legal' })
    for (let i = 0; i < 8; i++) s = reducer(s, { type: 'syncApplied' })
    s = reducer(s, { type: 'minuta' })
    s = reducer(s, { type: 'armFailure', on: true })
    expect(s.clock).not.toBe(D0)
    expect(reducer(s, { type: 'reset' })).toEqual(createInitialState())
  })
})
