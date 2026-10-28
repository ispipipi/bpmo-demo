import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { Figure, KpiCard, KpiRow, MiniChip, SubCard } from '../components/dashboard'
import { Skeleton } from '../components/feedback'
import { IconArrowRight, IconLock } from '../components/Icons'
import { Meter } from '../components/Meter'
import { SeverityChip, StatusChip, type Severity } from '../components/StatusChip'
import { useLoading } from '../components/useLoading'
import { dashboardKpis } from '../domain/derive/kpis'
import { openFindings } from '../domain/derive/mpi'
import { categoryStatus, committeeNoticeActive, processStatus } from '../domain/derive/tones'
import { canWrite } from '../domain/permissions'
import { formatDate } from '../lib/dates'
import { formatNumber, plural } from '../lib/format'
import { useStore } from '../store/StoreProvider'

const SEVERITIES: readonly Severity[] = ['Crítica', 'Alta', 'Media', 'Informativa']
const num = (n: number) => <AnimatedNumber value={n} />

export default function DashboardPage() {
  const { state } = useStore()
  const loading = useLoading()
  const legal = !canWrite(state.role)
  const k = useMemo(() => dashboardKpis(state), [state])
  const status = (c: Parameters<typeof categoryStatus>[0]) => categoryStatus(c, state)
  const p = (id: Parameters<typeof processStatus>[0]) => processStatus(id, state)

  const { atencion: a, riesgo, registro: r, terceros, gobernanza: g, reporte } = k
  const findings = openFindings(state)
  const mpiTone = p('P20').tone
  const noticeNear = committeeNoticeActive(state)

  const atencion = legal ? (
    <KpiCard tone={status('Atención a titulares y a la autoridad').tone} to="/arcop" title="Atención a titulares y a la autoridad" chip={status('Atención a titulares y a la autoridad')}>
      <Figure value={num(a.arcopOpen)} unit="ARCOP abiertas" />
      <div className="mt-3">
        <KpiRow label="Vencidas" value={a.arcopOverdue} tone={a.arcopOverdue > 0 ? 'crit' : undefined} />
        <KpiRow label="Por vencer" value={a.arcopDueSoon} tone={a.arcopDueSoon > 0 ? 'warn' : undefined} />
        <KpiRow label="Certificación MPI" value={`${a.mpiPct === null ? '—' : `${a.mpiPct} %`} · ${a.mpiStatus}`} />
        <KpiRow label="Autodenuncias abiertas" value={a.findingsOpen} />
      </div>
    </KpiCard>
  ) : (
    <KpiCard tone={status('Atención a titulares y a la autoridad').tone} title="Atención a titulares y a la autoridad" chip={status('Atención a titulares y a la autoridad')}>
      <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2 min-[1200px]:grid-cols-[1.4fr_1fr_1fr]">
        <SubCard to="/arcop" title="Solicitudes ARCOP" process="P1">
          <Figure value={num(a.arcopOpen)} unit="abiertas" />
          <div className="mt-3 flex flex-wrap gap-2">
            <MiniChip tone="crit" muted={a.arcopOverdue === 0}>{a.arcopOverdue} {plural(a.arcopOverdue, 'vencida', 'vencidas')}</MiniChip>
            <MiniChip tone="warn" muted={a.arcopDueSoon === 0}>{a.arcopDueSoon} por vencer</MiniChip>
            <MiniChip>{a.arcopClosedInTimePct === null ? '—' : `${a.arcopClosedInTimePct} %`} cerradas en plazo</MiniChip>
          </div>
        </SubCard>
        <SubCard to="/mpi" title="Certificación MPI" process="P20">
          <Figure value={a.mpiPct === null ? '—' : <>{num(a.mpiPct)} %</>} unit="ítems cumplen" faint={a.mpiPct === null} />
          <div className="mt-3"><Meter value={a.mpiPct ?? 0} tone={mpiTone} label="Ítems de la certificación MPI que cumplen" /></div>
          <div className="mt-3"><StatusChip tone={mpiTone} label={a.mpiStatus} size="md" /></div>
        </SubCard>
        <SubCard to="/mpi?tab=autodenuncia" title="Autodenuncia" process="P19">
          <Figure value={num(a.findingsOpen)} unit={plural(a.findingsOpen, 'abierta', 'abiertas')} />
          <p className="mt-3 text-dense text-ink-soft">
            {findings.length === 0 ? 'Sin hallazgos abiertos' : findings.length === 1 ? `Hallazgo en estado ${findings[0]?.stage}` : `${findings.length} hallazgos en curso`}
          </p>
          <div className="mt-3"><StatusChip tone={p('P19').tone} label={p('P19').label} size="md" /></div>
        </SubCard>
      </div>
    </KpiCard>
  )

  const registro = (
    <KpiCard tone={status('Registro y documentación').tone} title="Registro y documentación" chip={status('Registro y documentación')}>
      <Link to="/rat" className="block text-ink hover:text-ink">
        <Figure value={<>RAT&nbsp;&nbsp;v{r.ratVersion}</>} unit={<span className="font-mono">act. {formatDate(r.ratUpdatedAt)}</span>} />
      </Link>
      <div className="mt-3">
        <KpiRow
          to="/rat?tab=solicitudes"
          label="Solicitudes RAT en validación"
          value={r.ratRequestsOverdue > 0 ? `${r.ratRequestsOverdue} fuera de plazo` : r.ratRequestsInValidation}
          tone={r.ratRequestsOverdue > 0 ? 'crit' : undefined}
        />
        <KpiRow to="/consentimientos" label="Titulares vigentes" value={<AnimatedNumber value={r.activeHolders} format={formatNumber} />} />
        <KpiRow to="/consentimientos" label="Revocaciones últimos 30 días" value={<AnimatedNumber value={r.revocations30} />} />
        <KpiRow to="/proveedores?filtro=sin-garantia" label="Transferencias intl. sin mecanismo de garantía" value={r.transfersWithoutGuarantee} tone={r.transfersWithoutGuarantee > 0 ? 'crit' : undefined} />
      </div>
    </KpiCard>
  )

  const terceros_ = (
    <KpiCard tone={status('Terceros').tone} to="/proveedores?filtro=sin-dpa" title="Terceros" chip={status('Terceros')}>
      <Figure value={num(terceros.withoutValidDpa)} unit={plural(terceros.withoutValidDpa, 'proveedor sin DPA vigente', 'proveedores sin DPA vigente')} />
    </KpiCard>
  )

  const gobernanza = (
    <KpiCard tone={status('Gobernanza interna').tone} to="/comites" title="Gobernanza interna" chip={status('Gobernanza interna')}>
      <Figure value={num(g.overdueAgreements)} unit={plural(g.overdueAgreements, 'acuerdo vencido', 'acuerdos vencidos')} />
      <div className="mt-3">
        <KpiRow
          label="Próximo comité"
          value={g.nextCommitteeAt ? `${formatDate(g.nextCommitteeAt)}${noticeNear ? ` · en ${g.nextCommitteeInDays} d` : ''}` : '—'}
          tone={noticeNear ? 'warn' : undefined}
        />
      </div>
    </KpiCard>
  )

  const riesgo_ = (
    <KpiCard tone={status('Gestión de riesgo y proyectos').tone} to="/riesgo" title="Gestión de riesgo y proyectos" chip={status('Gestión de riesgo y proyectos')}>
      <Figure value={num(riesgo.unevaluated)} unit={plural(riesgo.unevaluated, 'proyecto sin evaluar', 'proyectos sin evaluar')} />
      <div className="mt-3"><KpiRow label='Proyectos con "Requiere EIPD"' value={riesgo.requireEipd} /></div>
    </KpiCard>
  )

  const reporte_ = (
    <KpiCard tone={status('Reporte y mejora continua').tone} to="/reporteria/5" title="Reporte y mejora continua" chip={status('Reporte y mejora continua')}>
      <Figure value={reporte.lastMinutaAt ? <span className="font-mono text-[26px]">{formatDate(reporte.lastMinutaAt)}</span> : '—'} unit="última minuta generada" faint={!reporte.lastMinutaAt} />
    </KpiCard>
  )

  const cultura = (
    <Link to="/mapa" className="kpi-card kpi-card--na kpi-card--link flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card px-5 py-4 text-ink hover:text-ink" aria-label="Cultura: proceso no incluido en este demo. Ver mapa">
      <h2 className="text-overline uppercase text-ink-soft">CULTURA</h2>
      <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface px-3 text-label text-ink-soft"><IconLock size={13} /> No incluido en este demo</span>
      <span className="text-dense text-ink-soft">Proceso no incluido en este demo</span>
      <span className="ml-auto inline-flex items-center gap-1 text-label text-brand">Ver mapa <IconArrowRight size={14} /></span>
    </Link>
  )

  const alertas = (
    <div className="kpi-card kpi-card--ok flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card px-5 py-4">
      <h2 className="text-overline uppercase text-ink-soft">ALERTAS NUEVAS</h2>
      {SEVERITIES.map((s) => <SeverityChip key={s} severity={s} count={k.alertsBySeverity[s]} />)}
      <Link to="/alertas" className="ml-auto inline-flex items-center gap-1 text-label text-brand">Ver bandeja <IconArrowRight size={14} /></Link>
    </div>
  )

  const title = legal ? 'Resumen' : 'Dashboard'
  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-h1">{title}</h1>
        <p className="text-[15px] text-ink-soft">Estado de cumplimiento por categoría · ESVAL</p>
      </div>
      <Link to="/mapa" className="inline-flex items-center gap-1 text-label text-brand">Ver mapa de procesos <IconArrowRight size={14} /></Link>
    </div>
  )

  let body: ReactNode
  if (loading) {
    body = (
      <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2" aria-busy="true" aria-label="Cargando">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44" />)}
      </div>
    )
  } else if (legal) {
    body = (
      <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1200px]:grid-cols-3">
        {atencion}{registro}{terceros_}{gobernanza}{riesgo_}{reporte_}
        <div className="min-[1200px]:col-span-3 min-[640px]:col-span-2">{cultura}</div>
      </div>
    )
  } else {
    body = (
      <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-12">
        <div className="min-[900px]:col-span-12">{atencion}</div>
        <div className="min-[900px]:col-span-6">{registro}</div>
        <div className="flex flex-col gap-4 min-[900px]:col-span-6">{terceros_}{gobernanza}</div>
        <div className="min-[900px]:col-span-6">{riesgo_}</div>
        <div className="min-[900px]:col-span-6">{reporte_}</div>
        <div className="min-[900px]:col-span-12">{cultura}</div>
        <div className="min-[900px]:col-span-12">{alertas}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {header}
      {body}
    </div>
  )
}
