import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ApprovalCard } from '../components/ApprovalCard'
import { BlockedAction, BTN, EmptyState, Modal, Skeleton, useToast } from '../components/feedback'
import { IconInfo } from '../components/Icons'
import { SegmentBar } from '../components/Meter'
import { ProcessFicha } from '../components/ProcessFicha'
import { RatBanner } from '../components/RatBanner'
import { Card, Field, HistoryList, inputClass, Meta, TabBar, TextDialog } from '../components/record'
import { StateShape } from '../components/StatusChip'
import { useCrumbTone } from '../components/crumbTone'
import { useLoading } from '../components/useLoading'
import { canWrite } from '../domain/permissions'
import {
  applyRatOp,
  consentsOf,
  MIN_TEXT,
  ratRequestView,
  registerBlockers,
  requestWarnings,
  validateApproval,
  validateRejectReason,
  type RatOp,
} from '../domain/rat'
import { APPROVERS, type ActivityDraft, type Approver } from '../domain/types'
import { formatDate } from '../lib/dates'
import { useStore } from '../store/StoreProvider'
import { RatSlaChip, RequestStatusChip } from './RatPage'

type Dialog = { kind: 'approval'; approver: Approver } | { kind: 'reject' } | null

const FIELD_LABEL: Record<keyof ActivityDraft, string> = {
  name: 'Nombre',
  area: 'Área',
  purpose: 'Finalidad',
  legalBasis: 'Base de licitud',
  dataCategories: 'Categorías de datos',
  holders: 'Titulares',
  international: 'Transferencia internacional',
}
const show = (v: string | boolean) => (typeof v === 'boolean' ? (v ? 'Sí' : 'No') : v)

function ApprovalDialog({ approver, onClose, onSubmit }: { approver: Approver; onClose: () => void; onSubmit: (o: { approver: Approver; result: 'Aprobado' | 'Observado'; date: string; ref: string; comment: string }) => void }) {
  const { state } = useStore()
  const [who, setWho] = useState<Approver>(approver)
  const [result, setResult] = useState<'Aprobado' | 'Observado'>('Aprobado')
  const [date, setDate] = useState(state.clock)
  const [ref, setRef] = useState('')
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const errors = validateApproval(state, { result, date, ref, comment })
  const err = (k: keyof typeof errors) => (submitted ? errors[k] : undefined)
  return (
    <Modal
      title="Registrar visto bueno"
      variant="form"
      confirmLabel="Registrar visto bueno"
      onClose={onClose}
      onConfirm={() => {
        setSubmitted(true)
        if (Object.keys(errors).length === 0) onSubmit({ approver: who, result, date, ref, comment })
      }}
    >
      <p className="mb-4 text-[14px]">* obligatorio</p>
      <div className="flex flex-col gap-4">
        <Field id="vb-who" label="Aprobador" required>
          {(a) => (
            <select {...a} value={who} onChange={(e) => setWho(e.target.value as Approver)} className={`${inputClass()} h-10`}>
              {APPROVERS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          )}
        </Field>
        <div>
          <div className="mb-1.5 text-[14.5px] font-bold">Resultado *</div>
          <div role="group" aria-label="Resultado" className="flex rounded-ctl bg-sunken p-1">
            {(['Aprobado', 'Observado'] as const).map((r) => (
              <button key={r} type="button" aria-pressed={result === r} onClick={() => setResult(r)} className={`h-9 flex-1 rounded-[7px] text-[15px] font-bold ${result === r ? (r === 'Aprobado' ? 'bg-ok-soft text-ok-ink' : 'bg-warn-soft text-warn-ink') : 'text-ink-soft'}`}>
                {r === 'Aprobado' ? '✓ Aprobado' : '▲ Observado'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2">
          <Field id="vb-date" label="Fecha" required error={err('date')}>
            {(a) => <input {...a} type="date" value={date} max={state.clock} onChange={(e) => setDate(e.target.value)} className={`${inputClass(!!err('date'))} h-10 font-mono`} />}
          </Field>
          <Field id="vb-ref" label="Referencia del documento" required error={err('ref')}>
            {(a) => <input {...a} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="VB-034" className={`${inputClass(!!err('ref'))} h-10 font-mono`} />}
          </Field>
        </div>
        <Field id="vb-comment" label={result === 'Observado' ? 'Comentario' : 'Comentario (obligatorio si es Observado)'} required={result === 'Observado'} error={err('comment')}>
          {(a) => <textarea {...a} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} className={`${inputClass(!!err('comment'))} p-3`} />}
        </Field>
      </div>
    </Modal>
  )
}

export default function RatRequestPage() {
  const { id = '' } = useParams()
  const { state, dispatch } = useStore()
  const toast = useToast()
  const location = useLocation()
  const loading = useLoading()
  const writable = canWrite(state.role)

  const req = state.data.rat.requests.find((r) => r.id === id)
  const view = req ? ratRequestView(req, state) : null
  useCrumbTone(view?.tone ?? (req ? (req.status === 'Registrada' ? 'ok' : 'na') : null))
  const [tab, setTab] = useState<'detalle' | 'historial'>('detalle')
  const [dialog, setDialog] = useState<Dialog>(null)

  const back = `/rat?tab=solicitudes${(location.state as { from?: string } | null)?.from ?? ''}`
  const BackLink = <Link to={back} className="inline-flex w-fit items-center gap-1 text-label text-brand">← Volver a la lista</Link>

  if (loading) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true" aria-label="Cargando">
        <Skeleton className="h-6 w-48" /><Skeleton className="h-16" /><Skeleton className="h-40" /><Skeleton className="h-56" />
      </div>
    )
  }
  if (!req || !view) {
    return (
      <div className="flex flex-col gap-5">
        {BackLink}
        <EmptyState title={`No existe la solicitud ${id}`} text="Revisa el identificador o vuelve a la lista de solicitudes de cambio." action={<Link to="/rat?tab=solicitudes" className={BTN.secondary}>Ir a la lista</Link>} />
      </div>
    )
  }

  const activity = req.activityId ? state.data.rat.activities.find((a) => a.id === req.activityId) : undefined
  const open = view.open
  const canEdit = writable && open
  const blockers = registerBlockers(state, req)
  const consents = req.activityId ? consentsOf(state, req.activityId) : []
  const warnings = requestWarnings(state, { activityId: req.activityId, proposal: req.proposal }, req.id)
  const hasObserved = view.summary.observed > 0
  const nextVersion = state.data.rat.version + 1

  const run = (op: RatOp, success: string): boolean => {
    const r = applyRatOp(state, op)
    if (!r.ok) {
      toast({ kind: 'error', text: r.error })
      return false
    }
    dispatch({ type: 'rat', op })
    toast({ kind: 'success', text: success })
    return true
  }

  const changes: [string, string, string][] =
    req.proposal && activity
      ? (Object.keys(req.proposal) as (keyof ActivityDraft)[])
          .filter((k) => show(req.proposal![k]) !== show(activity[k]))
          .map((k) => [FIELD_LABEL[k], show(activity[k]), show(req.proposal![k])])
      : []

  return (
    <div className="flex flex-col gap-5">
      {BackLink}
      <ProcessFicha module="/rat" processes={['P6b']} />
      <RatBanner />

      <header
        className="rounded-card p-5 shadow-card min-[900px]:p-6"
        style={
          view.tone === 'crit'
            ? { background: 'radial-gradient(640px 220px at 0 0, var(--crit-soft), transparent 70%), #fff', boxShadow: 'inset 0 0 0 1.5px var(--crit)' }
            : view.tone === 'warn'
              ? { background: 'radial-gradient(640px 220px at 0 0, var(--warn-soft), transparent 70%), #fff' }
              : { background: 'var(--surface)' }
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-[26px] font-semibold leading-8">{req.id}</h1>
          <RatSlaChip v={view} />
          <RequestStatusChip status={req.status} />
          <div className="ml-auto flex flex-wrap gap-2">
            {canEdit && req.status === 'Recibida' && (
              <button type="button" className={BTN.primary} onClick={() => run({ kind: 'start', id: req.id }, `Validación de ${req.id} iniciada.`)}>Iniciar validación</button>
            )}
            {canEdit && req.status === 'Observada' && (
              <button type="button" className={BTN.primary} onClick={() => run({ kind: 'resubmit', id: req.id }, `${req.id} reingresada: los vistos buenos se reiniciaron.`)}>Reingresar corregida</button>
            )}
            {canEdit && req.status === 'En validación' && hasObserved && (
              <button type="button" className={BTN.secondary} onClick={() => run({ kind: 'return', id: req.id }, `${req.id} devuelta con observaciones al solicitante.`)}>Devolver con observaciones</button>
            )}
            {canEdit && req.status === 'En validación' && (
              <button type="button" className={BTN.danger} onClick={() => setDialog({ kind: 'reject' })}>Rechazar solicitud</button>
            )}
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 min-[900px]:grid-cols-5">
          <Meta label="Tipo">{req.type}</Meta>
          <Meta label="Actividad">{req.activityId ? <><span className="font-mono">{req.activityId}</span> {activity?.name ?? ''}</> : 'Actividad nueva'}</Meta>
          <Meta label="Solicitante">{req.requester}</Meta>
          <Meta label="Recibida"><span className="font-mono">{formatDate(req.receivedAt)}</span></Meta>
          <Meta label="Plazo interno"><span className={`font-mono ${view.tone === 'crit' ? 'text-crit-ink' : ''}`}>{formatDate(view.due)}</span></Meta>
        </dl>
      </header>

      <TabBar tab={tab} onChange={setTab} />

      {tab === 'historial' ? (
        <Card title="Historial de la solicitud"><HistoryList entries={req.history} formatDate={formatDate} /></Card>
      ) : (
        <>
          <Card title="Solicitud">
            <p className="text-body">{req.description}</p>
            {req.type === 'Modificar' && open && (
              <div className="mt-4 overflow-x-auto rounded-ctl border border-line-soft">
                <table className="w-full min-w-[520px] text-left text-[15px]">
                  <thead className="bg-sunken text-label text-ink-soft"><tr><th className="px-3 py-2">Campo</th><th className="px-3 py-2">Registro actual</th><th className="px-3 py-2">Propuesta</th></tr></thead>
                  <tbody>
                    {changes.length === 0 ? (
                      <tr><td colSpan={3} className="px-3 py-3 text-ink-soft">Sin cambios respecto del registro actual.</td></tr>
                    ) : changes.map(([k, a, b]) => (
                      <tr key={k} className="border-t border-line-soft align-top"><td className="px-3 py-2 font-semibold">{k}</td><td className="px-3 py-2 text-ink-soft">{a}</td><td className="px-3 py-2 font-semibold">{b}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(req.type === 'Crear' || (req.type === 'Modificar' && !open)) && req.proposal && (
              <dl className="mt-4 grid grid-cols-1 gap-3 min-[900px]:grid-cols-3">
                {(Object.keys(req.proposal) as (keyof ActivityDraft)[]).map((k) => <Meta key={k} label={FIELD_LABEL[k]}>{show(req.proposal![k])}</Meta>)}
              </dl>
            )}
          </Card>

          <section className="rounded-card bg-surface p-5 shadow-card min-[900px]:p-6" aria-label="Vistos buenos">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h2 className="text-[19px] font-extrabold">Vistos buenos</h2>
              <span className="text-dense text-ink-soft">{view.summary.approved} de {APPROVERS.length} aprobados</span>
              <SegmentBar
                label={`${view.summary.approved} de ${APPROVERS.length} vistos buenos aprobados`}
                segmentWidth={28}
                segments={APPROVERS.map((a) => ({ tone: req.approvals[a].state === 'Aprobado' ? 'ok' : req.approvals[a].state === 'Observado' ? 'warn' : 'empty' }))}
              />
              <span className="ml-auto text-dense text-ink-soft">Plazo interno: vence <span className="font-mono">{formatDate(view.due)}</span></span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 min-[640px]:grid-cols-3 min-[1200px]:grid-cols-5">
              {APPROVERS.map((a) => (
                <ApprovalCard key={a} approver={a} approval={req.approvals[a]} onRegister={canEdit && req.status === 'En validación' ? () => setDialog({ kind: 'approval', approver: a }) : undefined} />
              ))}
            </div>
            <div className="mt-5 border-t border-line-soft pt-4">
              {!open ? (
                <p className="text-dense text-ink-soft">{req.status === 'Registrada' ? `Registrada en el RAT. ${req.history.at(-1)?.text ?? ''}` : 'Solicitud rechazada: el RAT no tuvo cambios.'}</p>
              ) : canEdit ? (
                blockers.length === 0 ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" className={BTN.primary} onClick={() => run({ kind: 'register', id: req.id }, `Registrado en el RAT, versión ${nextVersion} (simulado).`)}>Registrar en RAT (simulado)</button>
                    <span className="text-dense text-ink-soft">Al registrar, el RAT pasa a la versión {nextVersion}.</span>
                  </div>
                ) : (
                  <BlockedAction label="Registrar en RAT (simulado)" reasons={[...blockers, ...(blockers.length === 1 && view.summary.approved < APPROVERS.length ? [`Al registrar, el RAT pasa a la versión ${nextVersion}.`] : [])]} />
                )
              ) : (
                <p className="text-dense text-ink-soft">El registro en el RAT lo realiza el Analista PMO una vez reunidos los 5 vistos buenos.</p>
              )}
            </div>
          </section>

          {warnings.map((w) => (
            <p key={w.kind} className="flex items-start gap-2 rounded-ctl bg-sunken px-4 py-3 text-dense text-ink-soft"><IconInfo size={16} className="mt-0.5 flex-none" /> {w.text}</p>
          ))}
          {req.type === 'Eliminar' && open && consents.length > 0 && (
            <p role="alert" className="flex items-start gap-2 rounded-ctl bg-crit-soft px-4 py-3 text-dense text-crit-ink"><StateShape tone="crit" size={10} /> La actividad tiene consentimientos asociados ({consents.map((c) => c.purpose).join(', ')}): no se puede eliminar hasta gestionarlos.</p>
          )}
        </>
      )}

      {dialog?.kind === 'approval' && (
        <ApprovalDialog
          approver={dialog.approver}
          onClose={() => setDialog(null)}
          onSubmit={(o) => run({ kind: 'approval', id: req.id, ...o }, `Visto bueno de ${o.approver} registrado: ${o.result}.`) && setDialog(null)}
        />
      )}
      {dialog?.kind === 'reject' && (
        <TextDialog
          title={`¿Rechazar ${req.id}?`}
          label="Motivo"
          min={MIN_TEXT}
          confirmLabel="Rechazar solicitud"
          destructive
          intro="La solicitud se cierra como rechazada y el RAT no cambia. No se puede deshacer."
          validate={validateRejectReason}
          onClose={() => setDialog(null)}
          onSubmit={(reason) => run({ kind: 'reject', id: req.id, reason }, `${req.id} rechazada; el RAT no cambió.`) && setDialog(null)}
        />
      )}
    </div>
  )
}
