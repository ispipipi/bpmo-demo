import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BlockedAction, BTN, EmptyState, Skeleton, useToast } from '../components/feedback'
import { ProcessFicha } from '../components/ProcessFicha'
import { Card, Field, HistoryList, inputClass, Meta, TabBar, TextDialog } from '../components/record'
import { Stepper } from '../components/Stepper'
import { StateShape } from '../components/StatusChip'
import { useCrumbTone } from '../components/crumbTone'
import { useLoading } from '../components/useLoading'
import {
  advanceBlockers,
  applyFindingOp,
  canRetreat,
  ESVAL_AREAS,
  HYPOTHETICAL_NOTICE,
  MIN_TEXT,
  PACKAGE_NOTICE,
  SEVERITIES,
  stageIndex,
  validateAction,
  validateEvaluation,
  validateReason,
  validateSignoff,
  type FindingOp,
} from '../domain/finding'
import { canWrite } from '../domain/permissions'
import { FINDING_STAGES, type Finding } from '../domain/types'
import { formatDate } from '../lib/dates'
import { useStore } from '../store/StoreProvider'
import { SeverityLabel } from './MpiPage'

type Run = (op: FindingOp, success: string) => boolean

function EvaluationForm({ f, run }: { f: Finding; run: Run }) {
  const [severity, setSeverity] = useState<string>(f.severity ?? '')
  const [affectedData, setAffectedData] = useState(f.affectedData ?? '')
  const [holders, setHolders] = useState(f.holdersEstimate === null ? '' : String(f.holdersEstimate))
  const [cause, setCause] = useState(f.cause ?? '')
  const [submitted, setSubmitted] = useState(false)
  const errors = validateEvaluation({ severity, affectedData, holdersEstimate: holders, cause })
  const e = (k: keyof typeof errors) => (submitted ? errors[k] : undefined)
  return (
    <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
      <Field id="ev-severity" label="Gravedad" required error={e('severity')}>
        {(a) => (
          <select {...a} value={severity} onChange={(ev) => setSeverity(ev.target.value)} className={`${inputClass(!!e('severity'))} h-10`}>
            <option value="">Elige la gravedad…</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </Field>
      <Field id="ev-holders" label="Cantidad estimada de titulares" required error={e('holdersEstimate')}>
        {(a) => <input {...a} inputMode="numeric" value={holders} onChange={(ev) => setHolders(ev.target.value)} className={`${inputClass(!!e('holdersEstimate'))} h-10 font-mono`} />}
      </Field>
      <Field id="ev-data" label="Datos afectados" required error={e('affectedData')}>
        {(a) => <input {...a} value={affectedData} onChange={(ev) => setAffectedData(ev.target.value)} className={`${inputClass(!!e('affectedData'))} h-10`} />}
      </Field>
      <Field id="ev-cause" label="Causa" required error={e('cause')}>
        {(a) => <input {...a} value={cause} onChange={(ev) => setCause(ev.target.value)} className={`${inputClass(!!e('cause'))} h-10`} />}
      </Field>
      <div className="min-[900px]:col-span-2">
        <button
          type="button"
          className={BTN.secondary}
          onClick={() => {
            setSubmitted(true)
            if (Object.keys(errors).length === 0) run({ kind: 'evaluate', id: f.id, severity: severity as 'Baja', affectedData, holdersEstimate: holders, cause }, 'Evaluación guardada.')
          }}
        >
          Guardar evaluación
        </button>
      </div>
    </div>
  )
}

function PlanEditor({ f, run }: { f: Finding; run: Run }) {
  const { state } = useStore()
  const [action, setAction] = useState('')
  const [owner, setOwner] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const errors = validateAction({ action, owner, dueAt })
  const e = (k: keyof typeof errors) => (submitted ? errors[k] : undefined)
  return (
    <div>
      {f.plan.length > 0 && (
        <ul className="mb-4">
          {f.plan.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 border-t border-line-soft py-2.5 text-dense first:border-t-0">
              <span><strong className="font-semibold">{a.action}</strong><br /><span className="text-[14.5px] text-ink-soft">{a.owner} · comprometida para el <span className="font-mono">{formatDate(a.dueAt)}</span></span></span>
              <button type="button" className={BTN.ghost} onClick={() => run({ kind: 'planRemove', id: f.id, actionId: a.id }, 'Acción quitada del plan.')}>Quitar</button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-[1.6fr_1fr_150px_auto]">
        <Field id="plan-action" label="Acción" required error={e('action')}>{(a) => <input {...a} value={action} onChange={(ev) => setAction(ev.target.value)} className={`${inputClass(!!e('action'))} h-10`} />}</Field>
        <Field id="plan-owner" label="Responsable (área de Sanitor)" required error={e('owner')}>
          {(a) => (
            <select {...a} value={owner} onChange={(ev) => setOwner(ev.target.value)} className={`${inputClass(!!e('owner'))} h-10`}>
              <option value="">Elige el área…</option>
              {ESVAL_AREAS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          )}
        </Field>
        <Field id="plan-due" label="Fecha comprometida" required error={e('dueAt')}>{(a) => <input {...a} type="date" value={dueAt} min={state.clock} onChange={(ev) => setDueAt(ev.target.value)} className={`${inputClass(!!e('dueAt'))} h-10 font-mono`} />}</Field>
        <div className="flex items-end">
          <button
            type="button"
            className={BTN.secondary}
            onClick={() => {
              setSubmitted(true)
              if (Object.keys(errors).length === 0 && run({ kind: 'planAdd', id: f.id, action, owner, dueAt }, 'Acción agregada al plan.')) {
                setAction(''); setOwner(''); setDueAt(''); setSubmitted(false)
              }
            }}
          >
            Agregar acción
          </button>
        </div>
      </div>
    </div>
  )
}

function SignoffForm({ title, sub, byLabel, dateLabel, refLabel, byPlaceholder, refPlaceholder, submitLabel, onSubmit }: { title: string; sub: string; byLabel: string; dateLabel: string; refLabel: string; byPlaceholder: string; refPlaceholder: string; submitLabel: string; onSubmit: (v: { by: string; date: string; ref: string }) => void }) {
  const { state } = useStore()
  const [by, setBy] = useState('')
  const [date, setDate] = useState(state.clock)
  const [ref, setRef] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const errors = validateSignoff(state, { by, date, ref })
  const e = (k: keyof typeof errors) => (submitted ? errors[k] : undefined)
  return (
    <div>
      <h3 className="text-[21px] font-extrabold leading-6">{title}</h3>
      <p className="mt-1 text-dense text-ink-soft">{sub}</p>
      <div className="mt-4 grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
        <Field id="so-by" label={byLabel} required error={e('by')}>{(a) => <input {...a} value={by} placeholder={byPlaceholder} onChange={(ev) => setBy(ev.target.value)} className={`${inputClass(!!e('by'))} h-11`} />}</Field>
        <Field id="so-date" label={dateLabel} required error={e('date')}>{(a) => <input {...a} type="date" value={date} max={state.clock} onChange={(ev) => setDate(ev.target.value)} className={`${inputClass(!!e('date'))} h-11 font-mono`} />}</Field>
        <div className="min-[900px]:col-span-2">
          <Field id="so-ref" label={refLabel} required error={e('ref')}>{(a) => <input {...a} value={ref} placeholder={refPlaceholder} onChange={(ev) => setRef(ev.target.value)} className={`${inputClass(!!e('ref'))} h-11 font-mono`} />}</Field>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          className={BTN.primary}
          onClick={() => {
            setSubmitted(true)
            if (Object.keys(errors).length === 0) onSubmit({ by, date, ref })
          }}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  )
}

function CloseForm({ f, run }: { f: Finding; run: Run }) {
  const [result, setResult] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const blockers = advanceBlockers(f)
  const error = submitted && result.trim() === '' ? 'Indica el resultado del caso.' : undefined
  return (
    <div className="mt-4 border-t border-line-soft pt-4">
      <Field id="close-result" label="Resultado del caso" required error={error}>{(a) => <textarea {...a} rows={3} value={result} onChange={(ev) => setResult(ev.target.value)} className={`${inputClass(!!error)} p-3`} />}</Field>
      <div className="mt-3">
        {blockers.length > 0 ? (
          <BlockedAction label="Cerrar caso" reasons={blockers} />
        ) : (
          <button type="button" className={BTN.primary} onClick={() => { setSubmitted(true); if (result.trim() !== '') run({ kind: 'close', id: f.id, result }, `${f.id} cerrado.`) }}>Cerrar caso</button>
        )}
      </div>
    </div>
  )
}

const ReadOnly = ({ children }: { children: ReactNode }) => <div className="text-dense text-ink-soft">{children}</div>

export default function FindingPage() {
  const { id = '' } = useParams()
  const { state, dispatch } = useStore()
  const toast = useToast()
  const loading = useLoading()
  const writable = canWrite(state.role)
  const f = state.data.findings.find((x) => x.id === id)
  useCrumbTone(f ? (f.stage === 'Cerrado' ? 'ok' : f.severity === 'Alta' ? 'crit' : 'warn') : null)
  const [tab, setTab] = useState<'detalle' | 'historial'>('detalle')
  const [retreating, setRetreating] = useState(false)

  const BackLink = <Link to="/mpi?tab=autodenuncia" className="inline-flex w-fit items-center gap-1 text-label text-brand">← Volver a la lista</Link>

  if (loading) {
    return <div className="flex flex-col gap-5" aria-busy="true" aria-label="Cargando"><Skeleton className="h-6 w-48" /><Skeleton className="h-36" /><Skeleton className="h-64" /></div>
  }
  if (!f) {
    return <div className="flex flex-col gap-5">{BackLink}<EmptyState title={`No existe el hallazgo ${id}`} text="Revisa el identificador o vuelve a la lista de hallazgos." action={<Link to="/mpi?tab=autodenuncia" className={BTN.secondary}>Ir a la lista</Link>} /></div>
  }

  const run: Run = (op, success) => {
    const r = applyFindingOp(state, op)
    if (!r.ok) {
      toast({ kind: 'error', text: r.error })
      return false
    }
    dispatch({ type: 'finding', op })
    toast({ kind: 'success', text: success })
    return true
  }

  const idx = stageIndex(f.stage)
  const closed = f.stage === 'Cerrado'
  const edit = writable && !closed
  const blockers = advanceBlockers(f)
  const next = FINDING_STAGES[idx + 1]
  const stageTitle: Record<string, string> = {
    Detectado: 'Revisar el hallazgo',
    'En evaluación': 'Evaluar el hallazgo',
    'Plan de corrección': 'Definir el plan de corrección',
    'Aprobación interna': 'Registrar la aprobación interna',
    'Paquete listo': 'Generar el paquete para presentación',
    Presentada: 'Registrar constancia de presentación',
    'En seguimiento': 'Dar seguimiento al plan',
    Cerrado: 'Caso cerrado',
  }

  const stageBody = ((): ReactNode => {
    switch (f.stage) {
      case 'Detectado':
        return <p className="text-body">{f.description}</p>
      case 'En evaluación':
        return edit ? <EvaluationForm f={f} run={run} /> : <ReadOnly>La evaluación la completa el Analista PMO.</ReadOnly>
      case 'Plan de corrección':
        return edit ? <PlanEditor f={f} run={run} /> : <ReadOnly>{f.plan.length === 0 ? 'Aún no hay acciones en el plan.' : `${f.plan.length} acciones en el plan.`}</ReadOnly>
      case 'Aprobación interna':
        return edit ? (
          <SignoffForm title="Aprobación interna" sub="El Analista registra la aprobación del DPD o de Legal de Sanitor." byLabel="Quién aprobó" dateLabel="Fecha de aprobación" refLabel="Referencia del respaldo" byPlaceholder="DPD de Sanitor" refPlaceholder="Ej.: aprobacion_hal_0002.pdf" submitLabel="Registrar aprobación" onSubmit={(v) => run({ kind: 'approve', id: f.id, ...v }, 'Aprobación interna registrada.')} />
        ) : f.approval ? <ReadOnly>Aprobado por {f.approval.by} el {formatDate(f.approval.date)} ({f.approval.ref}).</ReadOnly> : <ReadOnly>Pendiente de aprobación interna.</ReadOnly>
      case 'Paquete listo':
        return (
          <div>
            <p className="rounded-ctl bg-sunken px-3 py-2 text-dense text-ink-soft">{PACKAGE_NOTICE}</p>
            {f.packageGeneratedAt ? (
              <p className="mt-3 text-dense">Paquete generado el <span className="font-mono">{formatDate(f.packageGeneratedAt)}</span>. <Link to={`/mpi/hallazgo/${f.id}/paquete`} className="font-bold">Ver paquete</Link></p>
            ) : edit ? (
              <button type="button" className={`${BTN.primary} mt-3`} onClick={() => run({ kind: 'package', id: f.id }, 'Paquete generado.')}>Generar paquete</button>
            ) : <ReadOnly>El paquete aún no se genera.</ReadOnly>}
          </div>
        )
      case 'Presentada':
        return edit ? (
          f.filing ? (
            <p className="text-dense">Constancia registrada: {f.filing.by}, <span className="font-mono">{formatDate(f.filing.date)}</span> ({f.filing.ref}).</p>
          ) : (
            <SignoffForm title="Registrar constancia de presentación" sub="Evidencia requerida del proceso. Los tres campos son obligatorios." byLabel="Quién presentó" dateLabel="Fecha de presentación" refLabel="Referencia del respaldo" byPlaceholder="DPD de Sanitor" refPlaceholder="Ej.: comprobante_agencia_0002.pdf" submitLabel="Registrar constancia" onSubmit={(v) => run({ kind: 'file', id: f.id, ...v }, 'Constancia de presentación registrada.')} />
          )
        ) : f.filing ? <ReadOnly>Presentada por {f.filing.by} el {formatDate(f.filing.date)} ({f.filing.ref}).</ReadOnly> : <ReadOnly>Pendiente de constancia de presentación.</ReadOnly>
      case 'En seguimiento':
        return (
          <div>
            <ul>
              {f.plan.map((a) => (
                <li key={a.id} className="flex items-center gap-3 border-t border-line-soft py-2.5 text-dense first:border-t-0">
                  <input type="checkbox" id={a.id} checked={a.done} disabled={!edit} onChange={(ev) => run({ kind: 'actionDone', id: f.id, actionId: a.id, done: ev.target.checked }, `Acción ${ev.target.checked ? 'completa' : 'pendiente'}.`)} className="h-4 w-4" />
                  <label htmlFor={a.id} className="flex-1"><strong className="font-semibold">{a.action}</strong><br /><span className="text-[14.5px] text-ink-soft">{a.owner} · <span className="font-mono">{formatDate(a.dueAt)}</span></span></label>
                </li>
              ))}
            </ul>
            {edit && <CloseForm f={f} run={run} />}
          </div>
        )
      case 'Cerrado':
        return (
          <div className="text-dense">
            <p>Cerrado el <span className="font-mono">{formatDate(f.closedAt ?? '')}</span>.</p>
            <p className="mt-1 text-ink-soft">Resultado: {f.closeResult}</p>
          </div>
        )
    }
  })()

  return (
    <div className="flex flex-col gap-5">
      {BackLink}
      <ProcessFicha module="/mpi/hallazgo" processes={['P19']} notice={HYPOTHETICAL_NOTICE} />

      <header className="rounded-card bg-surface p-5 shadow-card min-[900px]:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-[26px] font-semibold leading-8">{f.id}</h1>
          <span className="text-[17px] font-semibold">{f.description.length > 90 ? `${f.description.slice(0, 90)}…` : f.description}</span>
          <SeverityLabel f={f} />
          <span className="ml-auto text-dense text-ink-soft">Origen: {f.origin === 'Evento E8' ? 'evento E8 (simulado)' : f.originRef ? `${f.origin} ${f.originRef}` : f.origin}</span>
        </div>
        <div className="mt-6"><Stepper stages={FINDING_STAGES} current={idx} /></div>
      </header>

      <TabBar tab={tab} onChange={setTab} />

      {tab === 'historial' ? (
        <Card title="Historial del hallazgo"><HistoryList entries={f.history} formatDate={formatDate} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 min-[1200px]:grid-cols-[1.7fr_1fr]">
          <section className="rounded-card bg-surface p-5 shadow-[inset_0_0_0_1.5px_var(--brand)] min-[900px]:p-6" aria-label="Etapa actual">
            <div className="text-overline text-brand">ETAPA {idx + 1} DE {FINDING_STAGES.length}</div>
            <h2 className="mt-1 text-h2">{stageTitle[f.stage]}</h2>
            <div className="mt-4">{stageBody}</div>

            {edit && f.stage !== 'En seguimiento' && next && (
              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line-soft pt-4">
                {blockers.length === 0 ? (
                  <button type="button" className={BTN.primary} onClick={() => run({ kind: 'advance', id: f.id }, `${f.id} avanzó a "${next}".`)}>Avanzar a {next}</button>
                ) : (
                  <BlockedAction label={`Avanzar a ${next}`} reasons={blockers} />
                )}
                {canRetreat(f) && <button type="button" className={BTN.ghost} onClick={() => setRetreating(true)}>Retroceder etapa</button>}
              </div>
            )}
            {edit && f.stage === 'En seguimiento' && canRetreat(f) && (
              <div className="mt-4"><button type="button" className={BTN.ghost} onClick={() => setRetreating(true)}>Retroceder etapa</button></div>
            )}
          </section>

          <div className="flex flex-col gap-5">
            <Card title="Paquete para presentación">
              <p className="rounded-ctl bg-sunken px-3 py-2 text-dense text-ink-soft">{PACKAGE_NOTICE}</p>
              <dl className="mt-3">
                <div className="flex items-center justify-between border-t border-line-soft py-2.5 text-dense">
                  <dt>Acta de evaluación</dt>
                  <dd>{f.evaluatedAt ? <Link to={`/mpi/hallazgo/${f.id}/acta`} className="font-bold">Ver</Link> : <span className="text-ink-faint">Pendiente</span>}</dd>
                </div>
                <div className="flex items-center justify-between border-t border-line-soft py-2.5 text-dense">
                  <dt>Plan de corrección · {f.plan.length} {f.plan.length === 1 ? 'acción' : 'acciones'}</dt>
                  <dd>{f.plan.length > 0 && f.packageGeneratedAt ? <Link to={`/mpi/hallazgo/${f.id}/paquete`} className="font-bold">Ver</Link> : <span className="text-ink-faint">—</span>}</dd>
                </div>
                <div className="flex items-center justify-between border-t border-line-soft py-2.5 text-dense">
                  <dt>Aprobación interna{f.approval ? ` · ${f.approval.by}` : ''}</dt>
                  <dd className="font-mono text-[14.5px]">{f.approval ? formatDate(f.approval.date) : <span className="text-ink-faint">Pendiente</span>}</dd>
                </div>
              </dl>
              {f.packageGeneratedAt && <Link to={`/mpi/hallazgo/${f.id}/paquete`} className={`${BTN.secondary} mt-3 hover:text-ink`}>Ver paquete</Link>}
            </Card>
            <Card title="Datos del caso">
              <dl className="grid grid-cols-2 gap-3">
                <Meta label="Detectado"><span className="font-mono">{formatDate(f.detectedAt)}</span></Meta>
                <Meta label="Titulares">{f.holdersEstimate ?? '—'}</Meta>
                <Meta label="Datos afectados">{f.affectedData ?? '—'}</Meta>
                <Meta label="Causa">{f.cause ?? '—'}</Meta>
              </dl>
              {f.severity === 'Alta' && <p className="mt-3 flex items-center gap-2 rounded-ctl bg-crit-soft px-3 py-2 text-dense text-crit-ink"><StateShape tone="crit" size={10} /> Gravedad Alta: genera una alerta Alta.</p>}
            </Card>
          </div>
        </div>
      )}

      {retreating && (
        <TextDialog
          title="Retroceder etapa"
          label="Motivo"
          min={MIN_TEXT}
          confirmLabel="Retroceder etapa"
          intro={`El caso vuelve a "${FINDING_STAGES[idx - 1]}" y el motivo queda en el historial.`}
          validate={validateReason}
          onClose={() => setRetreating(false)}
          onSubmit={(reason) => run({ kind: 'retreat', id: f.id, reason }, `${f.id} volvió a "${FINDING_STAGES[idx - 1]}".`) && setRetreating(false)}
        />
      )}
    </div>
  )
}
