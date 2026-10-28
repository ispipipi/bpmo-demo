import { useMemo } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { BTN } from '../components/feedback'
import { DataTable, type Column } from '../components/DataTable'
import { FilterSelect, ToneSegmented } from '../components/filters'
import { IconSearch } from '../components/Icons'
import { ProcessFicha } from '../components/ProcessFicha'
import { StatusChip } from '../components/StatusChip'
import { useLoading } from '../components/useLoading'
import { ARCOP_TYPES, type ArcopStatus, type ArcopType } from '../domain/types'
import { arcopViews, filterArcop, slaCounts, type ArcopFilters, type ArcopView } from '../domain/derive/arcop'
import { formatDate } from '../lib/dates'
import { useStore } from '../store/StoreProvider'

const ESTADOS: readonly ArcopFilters['estado'][] = ['todos', 'abiertas', 'Nueva', 'En gestión', 'Respuesta lista', 'Cerrada']
const SLAS: readonly ArcopFilters['sla'][] = ['todos', 'crit', 'warn', 'ok']
const SLA_LABEL = { crit: 'Vencida', warn: 'Por vencer', ok: 'En plazo' } as const

export function DaysCell({ v }: { v: ArcopView }) {
  if (v.daysLeft === null) return <span className="text-ink-faint">—</span>
  const left = v.daysLeft
  const cls = v.tone === 'crit' ? 'font-bold text-crit-ink' : v.tone === 'warn' ? 'font-bold text-warn-ink' : ''
  return (
    <span className={cls}>
      {left < 0 ? `Vencida hace ${-left} d` : `${left} d`}
      {v.req.extension && <span className="ml-1.5 text-[14px] font-normal text-ink-soft">(prorrogada)</span>}
    </span>
  )
}

export const EstadoChip = ({ status }: { status: ArcopStatus }) => (
  <span className="inline-flex h-6 items-center whitespace-nowrap rounded-full bg-brand-soft px-2.5 text-label text-brand-deep">{status}</span>
)

export const SlaChip = ({ v }: { v: ArcopView }) =>
  v.tone ? <StatusChip tone={v.tone} label={SLA_LABEL[v.tone as 'crit' | 'warn' | 'ok']} /> : v.closed ? <StatusChip tone={v.closed.tone} label={v.closed.label} /> : null

export default function ArcopListPage() {
  const { state } = useStore()
  const loading = useLoading()
  const location = useLocation()
  const [params, setParams] = useSearchParams()

  const raw = (k: string) => params.get(k)
  const f: ArcopFilters = {
    q: raw('q') ?? '',
    estado: ((): ArcopFilters['estado'] => {
      const e = raw('estado') ?? (raw('filtro') === 'abiertas' ? 'abiertas' : 'todos')
      return (ESTADOS as readonly string[]).includes(e) ? (e as ArcopFilters['estado']) : 'todos'
    })(),
    tipo: (ARCOP_TYPES as readonly string[]).includes(raw('tipo') ?? '') ? (raw('tipo') as ArcopType) : 'todos',
    sla: (SLAS as readonly string[]).includes(raw('sla') ?? '') ? (raw('sla') as ArcopFilters['sla']) : 'todos',
  }
  const set = (key: string, value: string, neutral = 'todos') =>
    setParams((p) => {
      const n = new URLSearchParams(p)
      n.delete('filtro')
      if (value === neutral || value === '') n.delete(key)
      else n.set(key, value)
      return n
    }, { replace: true })

  const all = useMemo(() => arcopViews(state), [state])
  const rows = filterArcop(all, f)
  const counts = slaCounts(all, f)
  const active = f.q !== '' || f.estado !== 'todos' || f.tipo !== 'todos' || f.sla !== 'todos'
  const clear = () => setParams({}, { replace: true })

  const columns: Column<ArcopView>[] = [
    { key: 'id', header: 'ID', render: (v) => <Link to={`/arcop/${v.req.id}`} state={{ from: location.search }} className="font-mono text-[15px] font-semibold text-ink hover:text-brand">{v.req.id}</Link>, sort: (a, b) => a.req.id.localeCompare(b.req.id) },
    { key: 'type', header: 'Tipo', render: (v) => v.req.type, sort: (a, b) => a.req.type.localeCompare(b.req.type) },
    { key: 'holder', header: 'Titular', render: (v) => v.req.holder },
    { key: 'received', header: 'Recibida', align: 'right', render: (v) => <span className="font-mono text-[15px]">{formatDate(v.req.receivedAt)}</span>, sort: (a, b) => a.req.receivedAt.localeCompare(b.req.receivedAt) },
    { key: 'due', header: 'Vence', align: 'right', render: (v) => <span className={`font-mono text-[15px] ${v.tone === 'crit' ? 'font-bold text-crit-ink' : ''}`}>{formatDate(v.due)}</span>, sort: (a, b) => a.due.localeCompare(b.due) },
    { key: 'days', header: 'Días restantes', align: 'right', render: (v) => <DaysCell v={v} />, sort: (a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999) },
    { key: 'status', header: 'Estado', render: (v) => <EstadoChip status={v.req.status} /> },
    { key: 'sla', header: 'Semáforo', width: '150px', align: 'center', render: (v) => <SlaChip v={v} /> },
    {
      key: 'analyst',
      header: 'Analista',
      render: (v) =>
        v.req.analyst ?? <span className="inline-flex h-6 items-center rounded-full bg-warn-soft px-2.5 text-label text-warn-ink">Sin asignar</span>,
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-h1">Solicitudes ARCOP</h1>
      <ProcessFicha module="/arcop" processes={['P1']} />

      <section className="overflow-hidden rounded-card bg-surface shadow-card" aria-label="Lista de solicitudes ARCOP">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <label className="relative">
            <span className="sr-only">Buscar por ID o titular</span>
            <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              type="search"
              value={f.q}
              onChange={(e) => set('q', e.target.value, '')}
              placeholder="Buscar por ID, titular…"
              className="h-9 w-[280px] max-w-full rounded-ctl bg-surface pl-9 pr-3 text-[15px] shadow-[inset_0_0_0_1.5px_var(--line)] outline-none focus:shadow-[inset_0_0_0_1.5px_var(--brand-mid)]"
            />
          </label>
          <FilterSelect label="Estado" value={f.estado} onChange={(v) => set('estado', v)} options={ESTADOS.map((e) => ({ value: e, label: e === 'todos' ? 'Todos' : e === 'abiertas' ? 'Abiertas' : e }))} />
          <FilterSelect label="Tipo" value={f.tipo} onChange={(v) => set('tipo', v)} options={[{ value: 'todos', label: 'Todos' }, ...ARCOP_TYPES.map((t) => ({ value: t, label: t }))]} />
          <ToneSegmented
            label="Semáforo"
            value={f.sla}
            onChange={(v) => set('sla', v)}
            options={[
              { value: 'todos', label: 'Todos', count: counts.todos },
              { value: 'crit', label: 'Vencida', count: counts.crit, tone: 'crit' },
              { value: 'warn', label: 'Por vencer', count: counts.warn, tone: 'warn' },
              { value: 'ok', label: 'En plazo', count: counts.ok, tone: 'ok' },
            ]}
          />
          <span className="ml-auto text-[15px] text-ink-soft" aria-live="polite">{rows.length} {rows.length === 1 ? 'resultado' : 'resultados'}</span>
        </div>
        {active && (
          <div className="flex flex-wrap items-center gap-2 px-4 pb-3 text-[14.5px]">
            <span className="text-ink-soft">Filtros activos:</span>
            {f.q && <button type="button" className={BTN.ghost} onClick={() => set('q', '', '')}>Búsqueda: {f.q} ✕</button>}
            {f.estado !== 'todos' && <button type="button" className={BTN.ghost} onClick={() => set('estado', 'todos')}>Estado: {f.estado === 'abiertas' ? 'Abiertas' : f.estado} ✕</button>}
            {f.tipo !== 'todos' && <button type="button" className={BTN.ghost} onClick={() => set('tipo', 'todos')}>Tipo: {f.tipo} ✕</button>}
            {f.sla !== 'todos' && <button type="button" className={BTN.ghost} onClick={() => set('sla', 'todos')}>Semáforo: {SLA_LABEL[f.sla]} ✕</button>}
            <button type="button" className={`${BTN.ghost} text-brand`} onClick={clear}>Limpiar filtros</button>
          </div>
        )}
        <DataTable
          label="Solicitudes ARCOP"
          columns={columns}
          rows={rows}
          rowKey={(v) => v.req.id}
          rowHref={(v) => `/arcop/${v.req.id}`}
          rowState={{ from: location.search }}
          loading={loading}
          empty={{
            title: 'Ninguna solicitud coincide con los filtros',
            text: 'Prueba con otra búsqueda o limpia los filtros para ver todas las solicitudes.',
            action: <button type="button" className={BTN.secondary} onClick={clear}>Limpiar filtros</button>,
          }}
          footer={rows.length > 0 ? `Mostrando 1–${rows.length} de ${rows.length}` : undefined}
        />
      </section>
    </div>
  )
}
