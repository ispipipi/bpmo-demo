import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DataTable, type Column } from '../components/DataTable'
import { BTN } from '../components/feedback'
import { FilterSelect } from '../components/filters'
import { IconSearch } from '../components/Icons'
import { ProcessFicha } from '../components/ProcessFicha'
import { HistoryList, TabBar } from '../components/record'
import { RatBanner } from '../components/RatBanner'
import { PanelPairs, SidePanel } from '../components/SidePanel'
import { StateShape, StatusChip } from '../components/StatusChip'
import { useLoading } from '../components/useLoading'
import { activityStatus, ratRequestViews, requestsOnActivity, type RatRequestView } from '../domain/rat'
import { canWrite } from '../domain/permissions'
import type { RatActivity } from '../domain/types'
import { formatDate } from '../lib/dates'
import { useStore } from '../store/StoreProvider'
import { RatNewRequest } from './RatNewRequest'

type Tab = 'actividades' | 'solicitudes'
const SLA_LABEL = { crit: 'Fuera de plazo', warn: 'Por vencer', ok: 'En plazo' } as const

export const RequestStatusChip = ({ status }: { status: string }) => (
  <span className="inline-flex h-6 items-center whitespace-nowrap rounded-full bg-brand-soft px-2.5 text-label text-brand-deep">{status}</span>
)

export function RatSlaChip({ v }: { v: RatRequestView }) {
  if (!v.tone) return <span className="text-ink-faint">—</span>
  const left = v.daysLeft ?? 0
  const label = v.tone === 'crit' ? `Fuera de plazo hace ${-left} d` : v.tone === 'warn' ? `Vence en ${left} d` : SLA_LABEL.ok
  return <StatusChip tone={v.tone} label={label} />
}

export default function RatPage() {
  const { state } = useStore()
  const loading = useLoading()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'solicitudes' ? 'solicitudes' : 'actividades'
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(() => params.get('nueva') === '1' && canWrite(state.role))
  const [q, setQ] = useState('')
  const [area, setArea] = useState('todas')
  const [basis, setBasis] = useState('todas')
  const [estado, setEstado] = useState('todos')
  const writable = canWrite(state.role)

  const { activities } = state.data.rat
  const views = useMemo(() => ratRequestViews(state), [state])
  const openOverdue = views.filter((v) => v.tone === 'crit').length
  const openCount = views.filter((v) => v.open).length
  const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  const areas = [...new Set(activities.map((a) => a.area))].sort()
  const bases = [...new Set(activities.map((a) => a.legalBasis))].sort()
  const rows = activities.filter((a) => (q === '' || norm(a.name + a.id).includes(norm(q))) && (area === 'todas' || a.area === area) && (basis === 'todas' || a.legalBasis === basis))
  const reqRows = views.filter((v) => (estado === 'todos' || v.req.status === estado) && (q === '' || norm(v.req.id + v.req.requester + (v.req.activityId ?? '')).includes(norm(q))))
  const selectedActivity = activities.find((a) => a.id === selected)

  const setTab = (t: Tab) => setParams(t === 'actividades' ? {} : { tab: t }, { replace: true })
  const nameOf = (id: string | null) => (id ? activities.find((a) => a.id === id)?.name ?? '—' : 'Actividad nueva')

  const actColumns: Column<RatActivity>[] = [
    { key: 'id', header: 'ID', render: (a) => <span className="font-mono text-[15px] font-semibold">{a.id}</span>, sort: (x, y) => x.id.localeCompare(y.id) },
    { key: 'name', header: 'Actividad', render: (a) => <><div className="font-bold">{a.name}</div><div className="text-[14px] text-ink-soft">{a.area}</div></>, sort: (x, y) => x.name.localeCompare(y.name) },
    { key: 'basis', header: 'Base de licitud', render: (a) => <span className="text-ink-soft">{a.legalBasis}</span> },
    { key: 'purpose', header: 'Finalidad', render: (a) => <span className="text-ink-soft">{a.purpose}</span> },
    { key: 'intl', header: 'T. intl.', render: (a) => <span className="font-bold">{a.international ? 'Sí' : 'No'}</span> },
    {
      key: 'status',
      header: 'Estado',
      render: (a) => (activityStatus(state, a.id) === 'Vigente' ? <StatusChip tone="ok" label="Vigente" /> : <RequestStatusChip status="En revisión" />),
    },
  ]
  const reqColumns: Column<RatRequestView>[] = [
    { key: 'id', header: 'ID', render: (v) => <Link to={`/rat/solicitud/${v.req.id}`} className="font-mono text-[15px] font-semibold text-ink hover:text-brand">{v.req.id}</Link> },
    { key: 'type', header: 'Tipo', render: (v) => v.req.type },
    { key: 'act', header: 'Actividad', render: (v) => <span className="max-w-[220px] truncate">{v.req.activityId ? `${v.req.activityId} · ${nameOf(v.req.activityId)}` : 'Actividad nueva'}</span> },
    { key: 'requester', header: 'Solicitante', render: (v) => v.req.requester },
    { key: 'received', header: 'Recibida', align: 'right', render: (v) => <span className="font-mono text-[15px]">{formatDate(v.req.receivedAt)}</span> },
    { key: 'due', header: 'Plazo interno', align: 'right', render: (v) => <span className={`font-mono text-[15px] ${v.tone === 'crit' ? 'font-bold text-crit-ink' : ''}`}>{formatDate(v.due)}</span> },
    { key: 'status', header: 'Estado', render: (v) => <RequestStatusChip status={v.req.status} /> },
    { key: 'vb', header: 'Vistos buenos', align: 'center', render: (v) => <span className="font-mono text-[15px]">{v.summary.approved}/5</span> },
    { key: 'sla', header: 'Semáforo', width: '190px', align: 'center', render: (v) => <RatSlaChip v={v} /> },
  ]

  const open = selectedActivity ? requestsOnActivity(state, selectedActivity.id) : []

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1">Registro de actividades (RAT)</h1>
        {writable && <button type="button" className={BTN.primary} onClick={() => setCreating(true)}>Registrar nueva solicitud</button>}
      </div>
      <ProcessFicha module="/rat" processes={['P6b']} />
      <RatBanner />

      <TabBar
        tab={tab}
        onChange={setTab}
        tabs={[
          { id: 'actividades', label: `Actividades registradas · ${activities.length}` },
          { id: 'solicitudes', label: `Solicitudes de cambio · ${openCount} abiertas${openOverdue > 0 ? ` (${openOverdue} fuera de plazo)` : ''}` },
        ]}
      />

      <section className="overflow-hidden rounded-card bg-surface shadow-card" aria-label={tab === 'actividades' ? 'Actividades registradas' : 'Solicitudes de cambio'}>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <label className="relative">
            <span className="sr-only">Buscar</span>
            <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === 'actividades' ? 'Buscar actividad…' : 'Buscar solicitud…'} className="h-9 w-[260px] max-w-full rounded-ctl bg-surface pl-9 pr-3 text-[15px] shadow-[inset_0_0_0_1.5px_var(--line)] outline-none focus:shadow-[inset_0_0_0_1.5px_var(--brand-mid)]" />
          </label>
          {tab === 'actividades' ? (
            <>
              <FilterSelect label="Área" value={area} onChange={setArea} options={[{ value: 'todas', label: 'Todas' }, ...areas.map((a) => ({ value: a, label: a }))]} />
              <FilterSelect label="Base de licitud" value={basis} onChange={setBasis} options={[{ value: 'todas', label: 'Todas' }, ...bases.map((b) => ({ value: b, label: b }))]} />
            </>
          ) : (
            <FilterSelect label="Estado" value={estado} onChange={setEstado} options={['todos', 'Recibida', 'En validación', 'Observada', 'Aprobada', 'Rechazada', 'Registrada'].map((e) => ({ value: e, label: e === 'todos' ? 'Todos' : e }))} />
          )}
          <span className="ml-auto text-[15px] text-ink-soft" aria-live="polite">
            {tab === 'actividades' ? `${rows.length} de ${activities.length} visibles` : `${reqRows.length} de ${views.length} visibles`}
          </span>
        </div>

        {tab === 'actividades' ? (
          <DataTable
            label="Actividades del RAT"
            columns={actColumns}
            rows={rows}
            rowKey={(a) => a.id}
            loading={loading}
            onRowClick={(a) => setSelected(a.id)}
            isRowSelected={(a) => a.id === selected}
            empty={{ title: 'Ninguna actividad coincide con los filtros', text: 'Prueba con otra búsqueda, área o base de licitud.', action: <button type="button" className={BTN.secondary} onClick={() => { setQ(''); setArea('todas'); setBasis('todas') }}>Limpiar filtros</button> }}
            footer={`Mostrando 1–${rows.length} de ${rows.length}`}
          />
        ) : (
          <DataTable
            label="Solicitudes de cambio del RAT"
            columns={reqColumns}
            rows={reqRows}
            rowKey={(v) => v.req.id}
            rowHref={(v) => `/rat/solicitud/${v.req.id}`}
            loading={loading}
            empty={{ title: 'Sin solicitudes', text: writable ? 'Registra una nueva solicitud para crear, modificar o eliminar una actividad.' : 'Aún no hay solicitudes de cambio.' }}
            footer={`Mostrando 1–${reqRows.length} de ${reqRows.length}`}
          />
        )}
      </section>

      {selectedActivity && (
        <SidePanel
          title={selectedActivity.name}
          subtitle={<><span className="font-mono">{selectedActivity.id}</span> · {selectedActivity.area}</>}
          chip={activityStatus(state, selectedActivity.id) === 'Vigente' ? <StatusChip tone="ok" label="Vigente" size="md" /> : <RequestStatusChip status="En revisión" />}
          onClose={() => setSelected(null)}
        >
          <p className="rounded-ctl bg-sunken px-3 py-2 text-dense text-ink-soft">Detalle de solo lectura. Los cambios se hacen con una solicitud de cambio validada.</p>
          <PanelPairs
            pairs={[
              ['Finalidad', selectedActivity.purpose],
              ['Base de licitud', selectedActivity.legalBasis],
              ['Categorías de datos', selectedActivity.dataCategories],
              ['Titulares', selectedActivity.holders],
              ['Transferencia internacional', selectedActivity.international ? 'Sí' : 'No'],
            ]}
          />
          {open.map((r) => (
            <Link key={r.id} to={`/rat/solicitud/${r.id}`} className="flex items-center justify-between rounded-card bg-warn-soft px-4 py-3 text-warn-ink hover:text-warn-ink">
              <span><span className="block text-[15px] font-bold">Solicitud abierta</span><span className="font-mono text-[14.5px]">{r.id} · {Object.values(r.approvals).filter((a) => a.state === 'Aprobado').length} de 5</span></span>
              <span className="flex items-center gap-1 text-label"><StateShape tone="warn" size={9} /> Abrir ›</span>
            </Link>
          ))}
          <div>
            <h3 className="mb-2 border-b border-line pb-2 text-[15px] font-bold text-brand-deep">Historial de cambios</h3>
            <HistoryList entries={selectedActivity.history} formatDate={formatDate} />
          </div>
        </SidePanel>
      )}

      {creating && <RatNewRequest onClose={() => setCreating(false)} />}
    </div>
  )
}
