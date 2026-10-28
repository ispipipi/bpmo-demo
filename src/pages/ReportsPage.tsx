import type { ReactNode } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { BTN, EmptyState, useToast } from '../components/feedback'
import { IconDownload } from '../components/Icons'
import { ProcessFicha } from '../components/ProcessFicha'
import { StatusChip } from '../components/StatusChip'
import { useLoading } from '../components/useLoading'
import { APP_NAME, POWERED_BY, VERSION } from '../config'
import { canWrite } from '../domain/permissions'
import { minuta, PERIODS, report1, report1Table, report2, report2Table, report3, report3Table, report4, report4Table, type Period, type Table } from '../domain/reports'
import { downloadCsv, SIMULATED_LEGEND, toCsv } from '../lib/csv'
import { formatDate, monthTitle } from '../lib/dates'
import { useStore } from '../store/StoreProvider'

const REPORTS = [
  { n: 1, title: 'Estado de cumplimiento por proceso', usesPeriod: false },
  { n: 2, title: 'Gestión de solicitudes ARCOP', usesPeriod: true },
  { n: 3, title: 'RAT versionado y evidencias', usesPeriod: true },
  { n: 4, title: 'Transferencias internacionales y garantías', usesPeriod: false },
  { n: 5, title: 'Minuta de reporte mensual', usesPeriod: false },
] as const

const isPeriod = (v: string | null): v is Period => PERIODS.some((p) => p.value === v)

const Th = ({ children, right }: { children: ReactNode; right?: boolean }) => <th className={`px-3 py-2 ${right ? 'text-right' : 'text-left'}`}>{children}</th>
const Td = ({ children, right, mono }: { children: ReactNode; right?: boolean; mono?: boolean }) => <td className={`px-3 py-2 align-top ${right ? 'text-right' : ''} ${mono ? 'font-mono text-[15px]' : ''}`}>{children}</td>

function Sheet({ n, title, subtitle, children }: { n: number; title: string; subtitle: string; children: ReactNode }) {
  const { state } = useStore()
  return (
    <article className="w-full max-w-[820px] rounded-[6px] bg-white p-8 shadow-card print:max-w-none print:shadow-none min-[900px]:p-10" aria-label={title}>
      <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-4">
        <div>
          <p className="text-overline text-ink-soft">{n === 5 ? 'MINUTA DE REPORTE MENSUAL · P4' : `INFORME ${n} · P4`}</p>
          <h2 className="mt-1 text-h1">{title}</h2>
          <p className="mt-1 text-dense text-ink-soft">Fecha de demo <span className="font-mono">{formatDate(state.clock)}</span> · {subtitle}</p>
        </div>
        <img src={`${import.meta.env.BASE_URL}h2d-logo.png`} alt="H2D" width={56} height={56} className="h-14 w-14 flex-none object-contain" />
      </header>
      <div className="mt-5">{children}</div>
      <footer className="mt-8 flex flex-wrap justify-between gap-2 border-t border-line-soft pt-3 text-[14px] text-ink-soft">
        <span>{SIMULATED_LEGEND}</span>
        <span className="font-mono">{APP_NAME} v{VERSION} · {POWERED_BY}</span>
      </footer>
    </article>
  )
}

const NoData = () => <EmptyState title="Sin información para este período" text="Prueba con otro período: no hay registros que mostrar en este." />

export default function ReportsPage() {
  const { n: nParam } = useParams()
  const n = Number(nParam)
  const { state, dispatch } = useStore()
  const toast = useToast()
  const loading = useLoading(350)
  const [params, setParams] = useSearchParams()
  const period: Period = isPeriod(params.get('periodo')) ? (params.get('periodo') as Period) : 'mes'
  const legal = !canWrite(state.role)
  const report = REPORTS.find((r) => r.n === n)
  if (!report) return <Navigate to="/reporteria/1" replace />

  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? ''
  const subtitle = report.usesPeriod ? `Período: ${periodLabel}` : n === 5 ? `Mes actual (${monthTitle(state.clock)})` : 'Estado vigente'
  const lastMinuta = state.data.lastMinutaAt

  const download = (table: Table) => {
    downloadCsv(`bpmo-informe-${n}.csv`, toCsv(table.header, table.rows))
    toast({ kind: 'success', text: `CSV descargado con ${table.rows.length} filas. ${SIMULATED_LEGEND}.` })
  }

  let table: Table | null = null
  let body: ReactNode = null

  if (n === 1) {
    const secs = report1(state)
    table = report1Table(secs)
    body = (
      <div className="flex flex-col gap-6">
        {secs.map((sec) => (
          <section key={sec.category}>
            <div className="mb-2 flex flex-wrap items-center gap-3"><h3 className="text-h3">{sec.category}</h3><StatusChip tone={sec.status.tone} label={sec.status.label} /></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-[15px]"><thead className="bg-sunken text-label text-ink-soft"><tr><Th>N°</Th><Th>Proceso</Th><Th>Estado</Th><Th>Indicador principal</Th><Th>Evidencia requerida</Th></tr></thead>
              <tbody>{sec.rows.map((r) => (
                <tr key={r.id} className="border-t border-line-soft"><Td mono>{r.id}</Td><Td>{r.name}</Td><Td><StatusChip tone={r.status.tone} label={r.status.label} /></Td><Td>{r.indicator}</Td><Td><span className="text-ink-soft">{r.evidence}</span></Td></tr>
              ))}</tbody></table></div>
          </section>
        ))}
      </div>
    )
  } else if (n === 2) {
    const r = report2(state, period)
    table = report2Table(r)
    body = r.total === 0 ? (
      <>
        <div className="mb-4 grid grid-cols-3 gap-3">{['Solicitudes', '% cerradas en plazo', 'Tiempo promedio de cierre'].map((l) => <div key={l} className="rounded-ctl bg-sunken p-3"><div className="text-kpi text-ink-faint">—</div><div className="text-[14.5px] text-ink-soft">{l}</div></div>)}</div>
        <NoData />
      </>
    ) : (
      <>
        <div className="mb-5 grid grid-cols-3 gap-3">
          <div className="rounded-ctl bg-sunken p-3"><div className="text-kpi">{r.total}</div><div className="text-[14.5px] text-ink-soft">solicitudes recibidas</div></div>
          <div className="rounded-ctl bg-sunken p-3"><div className={`text-kpi ${r.closedInTimePct === null ? 'text-ink-faint' : ''}`}>{r.closedInTimePct === null ? '—' : `${r.closedInTimePct} %`}</div><div className="text-[14.5px] text-ink-soft">cerradas dentro de plazo</div></div>
          <div className="rounded-ctl bg-sunken p-3"><div className={`text-kpi ${r.avgCloseDays === null ? 'text-ink-faint' : ''}`}>{r.avgCloseDays === null ? '—' : `${r.avgCloseDays} d`}</div><div className="text-[14.5px] text-ink-soft">tiempo promedio de cierre</div></div>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-[15px]"><thead className="bg-sunken text-label text-ink-soft"><tr><Th>Tipo</Th>{r.columns.map((c) => <Th key={c} right>{c}</Th>)}<Th right>Total</Th></tr></thead>
          <tbody>{r.byType.map((t) => <tr key={t.type} className="border-t border-line-soft"><Td>{t.type}</Td>{r.columns.map((c) => <Td key={c} right mono>{t.counts[c]}</Td>)}<Td right mono><strong>{t.total}</strong></Td></tr>)}</tbody></table></div>
      </>
    )
  } else if (n === 3) {
    const r = report3(state, period)
    table = report3Table(r)
    body = (
      <>
        <p className="mb-4 text-body"><strong className="font-mono">RAT versión {r.version}</strong> · última actualización <span className="font-mono">{formatDate(r.updatedAt)}</span> · última revisión mensual <span className="font-mono">{formatDate(r.reviewedAt)}</span></p>
        <h3 className="mb-2 text-h3">Actividades registradas ({r.activities.length})</h3>
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-[15px]"><thead className="bg-sunken text-label text-ink-soft"><tr><Th>ID</Th><Th>Actividad</Th><Th>Base de licitud</Th><Th>Última modificación</Th><Th>Evidencias vinculadas</Th></tr></thead>
          <tbody>{r.activities.map((a) => <tr key={a.id} className="border-t border-line-soft"><Td mono>{a.id}</Td><Td>{a.name}<div className="text-[14px] text-ink-soft">{a.area}</div></Td><Td>{a.legalBasis}</Td><Td mono>{formatDate(a.lastChange)}</Td><Td mono>{a.evidence.length > 0 ? a.evidence.join(', ') : '—'}</Td></tr>)}</tbody></table></div>
        <h3 className="mb-2 mt-6 text-h3">Solicitudes de cambio del período</h3>
        {r.requests.length === 0 ? <NoData /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-[15px]"><thead className="bg-sunken text-label text-ink-soft"><tr><Th>ID</Th><Th>Tipo</Th><Th>Actividad</Th><Th>Estado</Th><Th right>Recibida</Th></tr></thead>
            <tbody>{r.requests.map((q) => <tr key={q.id} className="border-t border-line-soft"><Td mono>{q.id}</Td><Td>{q.type}</Td><Td mono>{q.activity}</Td><Td>{q.status}</Td><Td right mono>{formatDate(q.receivedAt)}</Td></tr>)}</tbody></table></div>
        )}
      </>
    )
  } else if (n === 4) {
    const rows = report4(state)
    table = report4Table(rows)
    body = rows.length === 0 ? <NoData /> : (
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-[15px]"><thead className="bg-sunken text-label text-ink-soft"><tr><Th>Proveedor</Th><Th>País</Th><Th>DPA</Th><Th right>Vence</Th><Th>Mecanismo de garantía</Th><Th>Estado</Th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id} className="border-t border-line-soft"><Td>{r.name}</Td><Td>{r.country}</Td><Td>{r.dpa}</Td><Td right mono>{r.due ? formatDate(r.due) : '—'}</Td><Td>{r.guarantee ? <>{r.guarantee}{r.guaranteeRef && <div className="font-mono text-[14px] text-ink-soft">{r.guaranteeRef}</div>}</> : <strong className="text-crit-ink">Sin definir</strong>}</Td><Td><StatusChip tone={r.status === 'Vigente' ? 'ok' : r.status.startsWith('Vence') ? 'warn' : 'crit'} label={r.status} /></Td></tr>)}</tbody></table></div>
    )
  } else {
    const m = minuta(state, { includeAlerts: !legal })
    body = (
      <div className="flex flex-col gap-6">
        <h3 className="sr-only">{m.title}</h3>
        <section>
          <h3 className="mb-2 text-h3">1. Semáforo por categoría</h3>
          {m.categories.map((c) => (
            <div key={c.category} className="grid grid-cols-1 items-center gap-x-4 gap-y-1 border-t border-line-soft py-2.5 min-[640px]:grid-cols-[1fr_150px_1.3fr]">
              <span className="text-[16px] font-semibold">{c.category}</span>
              <StatusChip tone={c.status.tone} label={c.status.label} />
              <span className="text-dense text-ink-soft">{c.summary}</span>
            </div>
          ))}
        </section>
        <div className={`grid grid-cols-1 gap-6 ${legal ? '' : 'min-[640px]:grid-cols-2'}`}>
          <section>
            <h3 className="mb-2 text-h3">2. ARCOP del período</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-ctl bg-sunken p-3"><div className="text-kpi">{m.arcop.received}</div><div className="text-[14.5px] text-ink-soft">{m.arcop.received === 1 ? 'recibida' : 'recibidas'}</div></div>
              <div className="rounded-ctl bg-sunken p-3"><div className="text-kpi">{m.arcop.closed}</div><div className="text-[14.5px] text-ink-soft">{m.arcop.closed === 1 ? 'cerrada' : 'cerradas'}</div></div>
              <div className={`rounded-ctl p-3 ${m.arcop.overdue > 0 ? 'bg-crit-soft text-crit-ink' : 'bg-sunken'}`}><div className="text-kpi">{m.arcop.overdue}</div><div className="text-[14.5px]">{m.arcop.overdue === 1 ? 'vencida' : 'vencidas'}</div></div>
            </div>
          </section>
          {!legal && (
            <section>
              <h3 className="mb-2 text-h3">3. Alertas críticas <span className="text-[14.5px] font-normal text-ink-soft">(solo Analista)</span></h3>
              {m.criticalAlerts.length === 0 ? <p className="text-dense text-ink-soft">Sin alertas críticas nuevas.</p> : <ul className="list-disc pl-5 text-dense">{m.criticalAlerts.map((a) => <li key={a}>{a}</li>)}</ul>}
            </section>
          )}
        </div>
        <section>
          <h3 className="mb-2 text-h3">{legal ? '3' : '4'}. Acuerdos vencidos</h3>
          {m.overdueAgreements.length === 0 ? <p className="text-dense text-ink-soft">Sin acuerdos vencidos.</p> : m.overdueAgreements.map((a) => (
            <p key={a.id} className="border-t border-line-soft py-2 text-dense"><span className="font-mono">{a.id}</span> · {a.description} · {a.owner} · <span className="font-mono">{formatDate(a.dueAt)}</span></p>
          ))}
        </section>
        <section>
          <h3 className="mb-2 text-h3">{legal ? '4' : '5'}. Próximos pasos</h3>
          <p className="text-dense text-ink-soft">{m.nextSteps ?? '—'}</p>
        </section>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3" data-no-print>
        <h1 className="text-h1">Reportería</h1>
        <div role="group" aria-label="Período" className="inline-flex rounded-ctl bg-sunken p-1">
          {PERIODS.map((p) => (
            <button key={p.value} type="button" aria-pressed={period === p.value} onClick={() => setParams({ periodo: p.value }, { replace: true })} className={`h-8 rounded-[7px] px-3 text-[15px] font-bold ${period === p.value ? 'bg-surface text-brand-deep shadow-card' : 'text-ink-soft hover:text-ink'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div data-no-print><ProcessFicha module="/reporteria" processes={['P4']} /></div>

      <div className="grid grid-cols-1 gap-5 min-[1200px]:grid-cols-[260px_1fr]">
        <nav aria-label="Informes" className="h-fit rounded-card bg-surface p-2 shadow-card print:hidden" data-no-print>
          {REPORTS.map((r) => (
            <Link key={r.n} to={`/reporteria/${r.n}?periodo=${period}`} aria-current={r.n === n ? 'page' : undefined} className={`flex gap-3 rounded-ctl px-3 py-2.5 text-dense ${r.n === n ? 'bg-brand-soft font-bold text-brand-deep' : 'text-ink hover:bg-sunken hover:text-ink'}`} style={r.n === n ? { boxShadow: 'inset 3px 0 0 var(--brand)' } : undefined}>
              <span className="font-mono text-[14.5px] text-ink-soft">{r.n}</span>{r.title}
            </Link>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3" data-no-print>
            <p className="text-[15px] text-ink-soft">Última minuta generada: <span className="font-mono">{lastMinuta ? formatDate(lastMinuta) : '—'}</span></p>
            <div className="flex flex-wrap gap-3">
              {table && <button type="button" className={BTN.secondary} onClick={() => table && download(table)}><IconDownload size={16} /> Descargar CSV</button>}
              <button type="button" className={BTN.secondary} onClick={() => window.print()}>Imprimir o guardar como PDF</button>
              {n === 5 && !legal && (
                <button type="button" className={BTN.primary} onClick={() => { dispatch({ type: 'minuta' }); toast({ kind: 'success', text: `Minuta de ${monthTitle(state.clock)} generada con los datos vigentes.` }) }}>Generar minuta</button>
              )}
            </div>
          </div>
          {loading ? <div className="h-96 animate-shimmer rounded-card skeleton" aria-busy="true" aria-label="Cargando" /> : <Sheet n={n} title={n === 5 ? `${minuta(state, { includeAlerts: false }).title}` : report.title} subtitle={subtitle}>{body}</Sheet>}
        </div>
      </div>
    </div>
  )
}
