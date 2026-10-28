import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DataTable, type Column } from '../components/DataTable'
import { BTN, useToast } from '../components/feedback'
import { FilterSelect, ToneSegmented } from '../components/filters'
import { SeverityChip } from '../components/StatusChip'
import { useLoading } from '../components/useLoading'
import { applyAlertOp, reminderTarget, type AlertOp } from '../domain/alertOps'
import { allAlerts } from '../domain/derive/alerts'
import type { Alert, AlertModule, AlertSeverity } from '../domain/types'
import { formatDate } from '../lib/dates'
import { useStore } from '../store/StoreProvider'

const SEVERITIES: readonly AlertSeverity[] = ['Crítica', 'Alta', 'Media', 'Informativa']
const SEV_ORDER: Record<AlertSeverity, number> = { Crítica: 0, Alta: 1, Media: 2, Informativa: 3 }
const SEV_TONE = { Crítica: 'crit', Alta: 'crit', Media: 'warn', Informativa: 'info' } as const
const MODULES: readonly AlertModule[] = ['ARCOP', 'RAT', 'Consentimientos', 'Proveedores', 'MPI y autodenuncia', 'Comités']

export default function AlertsPage() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const loading = useLoading()
  const [severity, setSeverity] = useState<'todas' | AlertSeverity>('todas')
  const [estado, setEstado] = useState('todas')
  const [module, setModule] = useState('todos')

  const all = useMemo(() => allAlerts(state).sort((a, b) => Number(a.status === 'Atendida') - Number(b.status === 'Atendida') || SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || b.date.localeCompare(a.date) || a.id.localeCompare(b.id)), [state])
  const base = all.filter((a) => (estado === 'todas' || a.status === estado) && (module === 'todos' || a.module === module))
  const shown = base.filter((a) => severity === 'todas' || a.severity === severity)
  const n = (s: AlertSeverity) => base.filter((a) => a.severity === s).length
  const pending = all.filter((a) => a.status === 'Nueva').length

  const run = (op: AlertOp, success: string) => {
    const r = applyAlertOp(state, op)
    if (!r.ok) return void toast({ kind: 'error', text: r.error })
    dispatch({ type: 'alert', op })
    toast({ kind: 'success', text: success })
  }

  const columns: Column<Alert>[] = [
    { key: 'severity', header: 'Severidad', width: '130px', render: (a) => <SeverityChip severity={a.severity} />, sort: (a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] },
    {
      key: 'message',
      header: 'Mensaje',
      render: (a) => (
        <span className={`flex max-w-[360px] items-start gap-2 whitespace-normal ${a.status === 'Nueva' ? 'font-semibold' : 'text-ink-soft'}`}>
          {a.status === 'Nueva' && <span className="mt-2 h-[7px] w-[7px] flex-none rounded-full bg-brand" aria-label="Nueva" />}
          {a.message}
        </span>
      ),
    },
    { key: 'entity', header: 'Entidad', render: (a) => <><div className="font-mono text-[14.5px]">{a.entityId ?? a.module}</div><div className="text-[14px] text-ink-soft">{a.module}</div></> },
    { key: 'date', header: 'Fecha demo', align: 'right', render: (a) => <span className="font-mono text-[15px]">{formatDate(a.date)}</span>, sort: (a, b) => a.date.localeCompare(b.date) },
    { key: 'status', header: 'Estado', render: (a) => <span className={a.status === 'Nueva' ? 'font-bold' : 'text-ink-soft'}>{a.status}</span> },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'right',
      render: (a) => (
        <span className="inline-flex items-center justify-end gap-2">
          {a.status === 'Nueva' && reminderTarget(state, a) && (
            <button type="button" className={BTN.ghost} onClick={() => run({ kind: 'reminder', id: a.id }, `Recordatorio enviado a ${reminderTarget(state, a)?.who} (simulado).`)}>Enviar recordatorio</button>
          )}
          {a.status === 'Nueva' && (
            <button type="button" className={`${BTN.secondary} h-8 px-3 text-[14.5px]`} onClick={() => run({ kind: 'attend', id: a.id }, 'Alerta marcada como atendida.')}>Marcar atendida</button>
          )}
          <Link to={a.to} className="text-label whitespace-nowrap">Abrir caso ›</Link>
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1">Alertas y SLA</h1>
          <p className="text-[17px] text-ink-soft">Qué empujar hoy. Las alertas por regla se recalculan siempre.</p>
        </div>
        <Link to="/alertas/parametros" className={`${BTN.secondary} hover:text-ink`}>Ir a Parámetros</Link>
      </div>

      <section className="overflow-hidden rounded-card bg-surface shadow-card" aria-label="Bandeja de alertas">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <ToneSegmented
            label="Severidad"
            value={severity}
            onChange={(v) => setSeverity(v as typeof severity)}
            options={[
              { value: 'todas', label: 'Todas', count: base.length },
              ...SEVERITIES.map((s) => ({ value: s, label: s, count: n(s), tone: SEV_TONE[s] })),
            ]}
          />
          <FilterSelect label="Estado" value={estado} onChange={setEstado} options={[{ value: 'todas', label: 'Todas' }, { value: 'Nueva', label: 'Nueva' }, { value: 'Atendida', label: 'Atendida' }]} />
          <FilterSelect label="Módulo" value={module} onChange={setModule} options={[{ value: 'todos', label: 'Todos' }, ...MODULES.map((m) => ({ value: m, label: m }))]} />
          <span className="ml-auto text-[15px] text-ink-soft" aria-live="polite">{shown.length} {shown.length === 1 ? 'resultado' : 'resultados'}</span>
        </div>
        <DataTable
            label="Alertas"
            columns={columns}
            rows={shown}
            rowKey={(a) => a.id}
            loading={loading}
            empty={
              pending === 0 && all.length === 0
                ? { title: 'Sin alertas pendientes. Todo bajo control.', text: 'Cuando una regla o un evento genere una alerta, aparecerá aquí.' }
                : { title: 'Ninguna alerta coincide con los filtros', text: 'Prueba con otra severidad, estado o módulo.', action: <button type="button" className={BTN.secondary} onClick={() => { setSeverity('todas'); setEstado('todas'); setModule('todos') }}>Limpiar filtros</button> }
            }
        />
      </section>
    </div>
  )
}
