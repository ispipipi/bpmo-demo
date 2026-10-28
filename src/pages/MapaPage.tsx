import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CATALOG, CATEGORIES, NOT_INCLUDED_TEXT, type Category, type Responsible } from '../domain/catalog'
import { estadoCounts, MAP_CSV_HEADER, mapCsvRows, mapSections, processMap, type MapFilters } from '../domain/derive/map'
import type { Tone } from '../domain/tone'
import { downloadCsv, toCsv, SIMULATED_LEGEND } from '../lib/csv'
import { BTN, EmptyState, Skeleton, useToast } from '../components/feedback'
import { FilterSelect, ToneSegmented } from '../components/filters'
import { IconChevronRight, IconDownload } from '../components/Icons'
import { ResponsibleChip } from '../components/ProcessFicha'
import { SegmentBar } from '../components/Meter'
import { StatusChip } from '../components/StatusChip'
import { useLoading } from '../components/useLoading'
import { useStore } from '../store/StoreProvider'

const RESPONSIBLES: readonly Responsible[] = ['H2D', 'Compartido', 'Cliente (supervisión H2D)']
const ESTADOS: readonly ('todos' | Tone)[] = ['todos', 'crit', 'warn', 'ok', 'info', 'na']
const COLS = 'grid grid-cols-1 items-start gap-1.5 min-[900px]:grid-cols-[56px_1.6fr_1fr_170px_1.4fr_170px] min-[900px]:items-center min-[900px]:gap-x-4'

const isCategory = (v: string | null): v is Category => CATEGORIES.some((c) => c === v)
const isResponsible = (v: string | null): v is Responsible => RESPONSIBLES.some((r) => r === v)
const isEstado = (v: string | null): v is 'todos' | Tone => ESTADOS.some((e) => e === v)

export default function MapaPage() {
  const { state } = useStore()
  const toast = useToast()
  const loading = useLoading()
  const [params, setParams] = useSearchParams()

  const filters: MapFilters = {
    category: isCategory(params.get('cat')) ? (params.get('cat') as Category) : 'todas',
    responsible: isResponsible(params.get('resp')) ? (params.get('resp') as Responsible) : 'todos',
    estado: isEstado(params.get('estado')) ? (params.get('estado') as 'todos' | Tone) : 'todos',
  }
  const set = (key: 'cat' | 'resp' | 'estado', value: string, neutral: string) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      if (value === neutral) next.delete(key)
      else next.set(key, value)
      return next
    }, { replace: true })

  const rows = useMemo(() => processMap(state), [state])
  const sections = useMemo(() => mapSections(state, filters), [state, filters.category, filters.responsible, filters.estado]) // eslint-disable-line react-hooks/exhaustive-deps
  const counts = estadoCounts(rows, filters)
  const includedTotal = CATALOG.filter((p) => p.module !== null).length
  const visible = sections.flatMap((s) => s.rows)
  const active = filters.category !== 'todas' || filters.responsible !== 'todos' || filters.estado !== 'todos'

  const download = () => {
    downloadCsv('bpmo-mapa-de-procesos.csv', toCsv(MAP_CSV_HEADER, mapCsvRows(visible)))
    toast({ kind: 'success', text: `CSV descargado con ${visible.length} procesos. ${SIMULATED_LEGEND}.` })
  }

  const segments = CATALOG.map((_, i) => ({ tone: (i < includedTotal ? 'info' : 'empty') as 'info' | 'empty' }))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h1">Mapa de procesos</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <p className="text-[15px] font-bold">{includedTotal} de {CATALOG.length} procesos operables en este demo</p>
            <SegmentBar segments={segments} label={`${includedTotal} de ${CATALOG.length} procesos operables`} />
          </div>
        </div>
        <button type="button" className={BTN.secondary} onClick={download} disabled={visible.length === 0}>
          <IconDownload size={16} /> Descargar CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect label="Categoría" value={filters.category} onChange={(v) => set('cat', v, 'todas')} options={[{ value: 'todas', label: 'Todas' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} />
        <FilterSelect label="Responsable" value={filters.responsible} onChange={(v) => set('resp', v, 'todos')} options={[{ value: 'todos', label: 'Todos' }, ...RESPONSIBLES.map((r) => ({ value: r, label: r }))]} />
        <ToneSegmented
          label="Estado"
          value={filters.estado}
          onChange={(v) => set('estado', v, 'todos')}
          options={[
            { value: 'todos', label: 'Todos', count: counts.todos },
            { value: 'crit', label: 'Rojo', count: counts.crit, tone: 'crit' },
            { value: 'warn', label: 'Amarillo', count: counts.warn, tone: 'warn' },
            { value: 'ok', label: 'Verde', count: counts.ok, tone: 'ok' },
            { value: 'info', label: 'Informativo', count: counts.info, tone: 'info' },
            { value: 'na', label: 'No incluido', count: counts.na, tone: 'na' },
          ]}
        />
        {active && (
          <button type="button" className={BTN.ghost} onClick={() => setParams({}, { replace: true })}>Limpiar filtros</button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando">
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      ) : sections.length === 0 ? (
        <EmptyState
          title="Ningún proceso coincide con los filtros"
          text="Prueba con otra categoría, responsable o estado."
          action={<button type="button" className={BTN.secondary} onClick={() => setParams({}, { replace: true })}>Limpiar filtros</button>}
        />
      ) : (
        sections.map((sec) => (
          <section key={sec.category} className="overflow-hidden rounded-card bg-surface shadow-card" aria-label={sec.category}>
            <header className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <h2 className="text-overline uppercase text-ink-soft">{sec.category}</h2>
              <StatusChip tone={sec.status.tone} label={sec.status.label} />
              <span className="ml-auto text-[13px] text-ink-soft">{sec.includedCount} de {sec.total} incluidos</span>
            </header>
            <div className="overflow-x-auto">
              <div>
                <div className={`${COLS} hidden h-9 bg-sunken px-5 text-[12px] font-bold text-ink-soft min-[900px]:grid`}>
                  <span>N°</span><span>Proceso</span><span>Periodicidad / gatillo</span><span>Responsable</span><span>Evidencia requerida</span><span>Estado</span>
                </div>
                {sec.rows.map((r) => {
                  const cells = (
                    <>
                      <span className={`font-mono text-[13px] ${r.included ? 'font-semibold' : 'text-ink-faint'}`}>{r.def.id}</span>
                      <span>
                        <span className={`block text-[13.5px] ${r.included ? 'font-bold' : 'text-ink-soft'}`}>{r.def.name}</span>
                        {!r.included && <span className="mt-0.5 block text-[12.5px] text-ink-soft">{NOT_INCLUDED_TEXT}</span>}
                      </span>
                      <span className="text-[13px] text-ink-soft">{r.def.trigger}</span>
                      <span><ResponsibleChip responsible={r.def.responsible} /></span>
                      <span className="text-[13px] text-ink-soft">{r.def.evidence}</span>
                      <span className="flex items-center justify-between gap-2">
                        {r.included ? <StatusChip tone={r.status.tone} label={r.status.label} /> : <StatusChip tone="na" label="No incluido" />}
                        {r.included && <IconChevronRight size={16} className="flex-none text-brand" />}
                      </span>
                    </>
                  )
                  return r.included ? (
                    <Link key={r.def.id} to={r.def.module ?? '/'} className={`${COLS} min-h-[56px] border-t border-line-soft px-5 py-2.5 text-ink transition-colors hover:bg-brand-wash hover:text-ink`}>
                      {cells}
                    </Link>
                  ) : (
                    <div key={r.def.id} aria-disabled="true" className={`${COLS} min-h-[56px] border-t border-line-soft bg-sunken px-5 py-2.5`}>
                      {cells}
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        ))
      )}
      <p className="text-[12.5px] text-ink-soft">{SIMULATED_LEGEND}. El catálogo de 22 procesos proviene del documento de H2D y no se edita.</p>
    </div>
  )
}
