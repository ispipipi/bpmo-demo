import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { BlockedAction, BTN, EmptyState, Modal, Skeleton, useToast } from '../components/feedback'
import { IconInfo } from '../components/Icons'
import { Meter } from '../components/Meter'
import { ProcessFicha } from '../components/ProcessFicha'
import { StateShape } from '../components/StatusChip'
import { useCrumbTone } from '../components/crumbTone'
import { Card, HistoryList, Meta, TabBar, TextDialog } from '../components/record'
import { useLoading } from '../components/useLoading'
import {
  ANALYSTS,
  applyArcopOp,
  closeBlockers,
  isOpen,
  MIN_EXTENSION_REASON,
  MIN_REJECTION_GROUND,
  possibleDuplicate,
  responseTemplate,
  validateExtensionReason,
  validateRejectionGround,
  validateResponse,
  type ArcopOp,
} from '../domain/arcop'
import { arcopView } from '../domain/derive/arcop'
import { canWrite } from '../domain/permissions'
import type { Subtask, SubtaskState } from '../domain/types'
import { formatDate } from '../lib/dates'
import { useStore } from '../store/StoreProvider'
import { DaysCell, EstadoChip, SlaChip } from './ArcopListPage'

type Dialog =
  | { kind: 'assign' }
  | { kind: 'evidence'; subtask: Subtask }
  | { kind: 'extension' }
  | { kind: 'reject' }
  | { kind: 'close' }
  | null

const SUBTASK_STATES: readonly SubtaskState[] = ['Pendiente', 'En curso', 'Completa']
const SUBTASK_CLASS: Record<SubtaskState, string> = {
  Pendiente: 'bg-sunken text-ink-soft',
  'En curso': 'bg-brand-soft text-brand-deep',
  Completa: 'bg-ok-soft text-ok-ink',
}

export default function ArcopDetailPage() {
  const { id = '' } = useParams()
  const { state, dispatch } = useStore()
  const toast = useToast()
  const location = useLocation()
  const loading = useLoading()
  const writable = canWrite(state.role)

  const req = state.data.arcop.find((r) => r.id === id)
  const view = req ? arcopView(req, state) : null
  useCrumbTone(view ? (view.tone ?? view.closed?.tone ?? null) : null)

  const [tab, setTab] = useState<'detalle' | 'historial'>('detalle')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [draftError, setDraftError] = useState<string | null>(null)
  const [evidence, setEvidence] = useState('')
  const [analyst, setAnalyst] = useState<string>(ANALYSTS[0])

  const back = `/arcop${(location.state as { from?: string } | null)?.from ?? ''}`
  const BackLink = (
    <Link to={back} className="inline-flex w-fit items-center gap-1 text-label text-brand">← Volver a la lista</Link>
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true" aria-label="Cargando">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    )
  }
  if (!req || !view) {
    return (
      <div className="flex flex-col gap-5">
        {BackLink}
        <EmptyState title={`No existe la solicitud ${id}`} text="Revisa el identificador o vuelve a la lista de solicitudes ARCOP." action={<Link to="/arcop" className={BTN.secondary}>Ir a la lista</Link>} />
      </div>
    )
  }

  const open = isOpen(req)
  const done = req.subtasks.filter((t) => t.state === 'Completa').length
  const blockers = closeBlockers(req)
  const duplicate = possibleDuplicate(state, req)
  const canEdit = writable && open

  /** Valida con la misma regla del dominio, aplica y avisa. Devuelve si tuvo efecto. */
  const run = (op: ArcopOp, success: string): boolean => {
    const r = applyArcopOp(state, op)
    if (!r.ok) {
      toast({ kind: 'error', text: r.error })
      return false
    }
    dispatch({ type: 'arcop', op })
    toast({ kind: 'success', text: success })
    return true
  }

  const startResponse = () => {
    setDraft(req.response || responseTemplate(req.type, req.holder))
    setDraftError(null)
    setEditing(true)
  }
  const saveResponse = () => {
    const bad = validateResponse(draft)
    if (bad) return setDraftError(bad)
    const all = req.subtasks.every((t) => t.state === 'Completa')
    if (run({ kind: 'response', id: req.id, text: draft }, all ? 'Respuesta guardada: el caso quedó en "Respuesta lista".' : 'Respuesta guardada. Aún faltan subtareas para dejar el caso en "Respuesta lista".')) setEditing(false)
  }

  const changeSubtask = (t: Subtask, next: SubtaskState) => {
    if (next === 'Completa') {
      setEvidence('')
      setDialog({ kind: 'evidence', subtask: t })
    } else {
      run({ kind: 'subtask', id: req.id, subtaskId: t.id, state: next }, `Subtarea "${t.name}" ahora está ${next === 'Pendiente' ? 'pendiente' : 'en curso'}.`)
    }
  }

  const critical = (text: string) => /SLA incumplido|fuera de plazo/.test(text)
  const recent = [...req.history].reverse().slice(0, 5)

  return (
    <div className="flex flex-col gap-5">
      {BackLink}
      <ProcessFicha module="/arcop" processes={['P1']} />

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
          <SlaChip v={view} />
          <EstadoChip status={req.status} />
          <div className="ml-auto flex flex-wrap gap-2">
            {canEdit && (
              <button type="button" className={BTN.secondary} onClick={() => { setAnalyst(ANALYSTS.find((a) => a !== req.analyst) ?? ANALYSTS[0]); setDialog({ kind: 'assign' }) }}>
                {req.analyst ? 'Reasignar analista' : 'Asignar analista'}
              </button>
            )}
            {canEdit && <button type="button" className={BTN.danger} onClick={() => setDialog({ kind: 'reject' })}>Rechazar como improcedente</button>}
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 min-[900px]:grid-cols-3 min-[1200px]:grid-cols-6">
          <Meta label="Tipo">{req.type}</Meta>
          <Meta label="Titular">{req.holder}</Meta>
          <Meta label="Canal">{req.channel}</Meta>
          <Meta label="Recibida"><span className="font-mono">{formatDate(req.receivedAt)}</span></Meta>
          <Meta label="Vencimiento"><span className={`font-mono ${view.tone === 'crit' ? 'text-crit-ink' : ''}`}>{formatDate(view.due)}</span></Meta>
          <Meta label={open ? 'Días restantes' : 'Cierre'}>
            {open ? <DaysCell v={view} /> : <span className="font-mono">{formatDate(req.closedAt ?? '')}</span>}
          </Meta>
        </dl>
        <div className="mt-4 text-dense">
          <span className="text-ink-soft">Analista: </span>
          {req.analyst ? <strong>{req.analyst}</strong> : <span className="inline-flex h-6 items-center rounded-full bg-warn-soft px-2.5 text-label text-warn-ink">Sin asignar</span>}
        </div>
        {duplicate && (
          <p className="mt-4 flex items-center gap-2 rounded-ctl bg-warn-soft px-3 py-2 text-dense text-warn-ink">
            <IconInfo size={16} className="flex-none" /> Posible duplicado de <Link to={`/arcop/${duplicate.id}`} className="font-bold underline">{duplicate.id}</Link> (mismo titular y tipo).
          </p>
        )}
      </header>

      <TabBar tab={tab} onChange={setTab} />

      {tab === 'historial' ? (
        <Card title="Historial del caso">
          <HistoryList entries={req.history} formatDate={formatDate} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 min-[1200px]:grid-cols-[1.7fr_1fr]">
          <div className="flex flex-col gap-5">
            <Card title="Subtareas" aside={<div className="flex items-center gap-3 text-[13px] text-ink-soft"><span>{done} de {req.subtasks.length} completas</span><Meter value={(done / req.subtasks.length) * 100} tone={done === req.subtasks.length ? 'ok' : 'info'} width={120} label="Subtareas completas" /></div>}>
              <ul>
                {req.subtasks.map((t) => (
                  <li key={t.id} className="grid grid-cols-1 items-center gap-x-4 gap-y-2 border-t border-line-soft py-3 first:border-t-0 min-[640px]:grid-cols-[112px_1fr_auto]">
                    {canEdit ? (
                      <select
                        aria-label={`Estado de la subtarea ${t.name}`}
                        value={t.state}
                        onChange={(e) => changeSubtask(t, e.target.value as SubtaskState)}
                        className={`h-7 w-[112px] cursor-pointer rounded-full px-2.5 text-label outline-none ${SUBTASK_CLASS[t.state]}`}
                      >
                        {SUBTASK_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <span className={`inline-flex h-7 w-[112px] items-center justify-center rounded-full text-label ${SUBTASK_CLASS[t.state]}`}>{t.state}</span>
                    )}
                    <div className="min-w-0">
                      <div className="text-dense font-semibold">{t.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-soft">
                        <span className="rounded-[6px] bg-sunken px-1.5 py-0.5 font-semibold">{t.responsible}</span>
                        {t.date && <span className="font-mono">{formatDate(t.date)}</span>}
                        {t.evidenceRef && <span className="font-mono">{t.evidenceRef}</span>}
                      </div>
                    </div>
                    {canEdit && t.external && t.state !== 'Completa' && (
                      <button type="button" className={BTN.ghost} onClick={() => run({ kind: 'reminder', id: req.id, subtaskId: t.id }, `Recordatorio enviado a ${t.responsible} (simulado).`)}>
                        Enviar recordatorio
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Respuesta al titular">
              {editing ? (
                <div>
                  <label htmlFor="respuesta" className="sr-only">Texto de la respuesta</label>
                  <textarea
                    id="respuesta"
                    value={draft}
                    rows={9}
                    onChange={(e) => { setDraft(e.target.value); setDraftError(null) }}
                    aria-invalid={draftError ? true : undefined}
                    aria-describedby={draftError ? 'respuesta-error' : undefined}
                    className="w-full rounded-ctl bg-surface p-3 text-[14px] shadow-[inset_0_0_0_1.5px_var(--line)] outline-none focus:shadow-[inset_0_0_0_1.5px_var(--brand-mid)]"
                    style={draftError ? { boxShadow: 'inset 0 0 0 1.5px var(--crit)' } : undefined}
                  />
                  {draftError && <p id="respuesta-error" className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-crit-ink"><StateShape tone="crit" size={9} /> {draftError}</p>}
                  <div className="mt-3 flex gap-3">
                    <button type="button" className={BTN.primary} onClick={saveResponse}>Guardar respuesta</button>
                    <button type="button" className={BTN.secondary} onClick={() => setEditing(false)}>Cancelar</button>
                  </div>
                </div>
              ) : req.response ? (
                <div>
                  <p className="whitespace-pre-wrap text-body">{req.response}</p>
                  {canEdit && req.status !== 'Nueva' && <button type="button" className={`${BTN.ghost} mt-3`} onClick={startResponse}>Editar respuesta</button>}
                </div>
              ) : canEdit ? (
                req.status === 'Nueva' ? (
                  <BlockedAction label="Preparar respuesta" reasons={['Asigna un analista o inicia una subtarea para pasar el caso a "En gestión".']} />
                ) : (
                  <div className="rounded-ctl border-[1.5px] border-dashed border-line p-5 text-center">
                    <p className="text-dense text-ink-soft">Aún no hay respuesta redactada.</p>
                    <button type="button" className={`${BTN.primary} mt-3`} onClick={startResponse}>Preparar respuesta</button>
                  </div>
                )
              ) : (
                <p className="text-dense text-ink-soft">Sin respuesta registrada.</p>
              )}
            </Card>

            <Card title="Prórroga">
              {req.extension ? (
                <div>
                  <dl className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-3">
                    <Meta label="Registrada"><span className="font-mono">{formatDate(req.extension.date)}</span></Meta>
                    <Meta label="Días"> +{req.extension.days}</Meta>
                    <Meta label="Nuevo vencimiento"><span className="font-mono">{formatDate(view.due)}</span></Meta>
                  </dl>
                  <p className="mt-3 text-dense text-ink-soft">Motivo: {req.extension.reason}</p>
                  {open && <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-ink-soft"><IconInfo size={14} /> Este caso ya fue prorrogado; no admite una segunda prórroga.</p>}
                </div>
              ) : canEdit ? (
                <button type="button" className={BTN.secondary} onClick={() => setDialog({ kind: 'extension' })}>Registrar prórroga</button>
              ) : (
                <p className="text-dense text-ink-soft">Sin prórroga.</p>
              )}
            </Card>
          </div>

          <div className="flex flex-col gap-5">
            <Card title="Cierre del caso">
              {!open ? (
                <div className="text-dense">
                  <p className="font-semibold">{req.resolution === 'Improcedente' ? 'Cerrada como improcedente' : view.closed?.label}</p>
                  <p className="mt-1 text-ink-soft">Cierre el <span className="font-mono">{formatDate(req.closedAt ?? '')}</span>.</p>
                  {req.rejectionGround && <p className="mt-2 text-ink-soft">Fundamento: {req.rejectionGround}</p>}
                  <p className="mt-2 text-[12.5px] text-ink-soft">Un caso cerrado no se puede reabrir en este demo.</p>
                </div>
              ) : writable ? (
                blockers.length === 0 ? (
                  <button type="button" className={BTN.primary} onClick={() => setDialog({ kind: 'close' })}>Cerrar caso</button>
                ) : (
                  <BlockedAction label="Cerrar caso" reasons={blockers} />
                )
              ) : (
                <p className="text-dense text-ink-soft">El cierre del caso lo gestiona el Analista PMO.</p>
              )}
            </Card>

            <Card title="Historial reciente">
              <ol className="flex flex-col gap-3">
                {recent.map((h, i) => (
                  <li key={i} className="flex gap-3 text-[13px]">
                    <span className="mt-1.5 flex-none">{critical(h.text) ? <StateShape tone="crit" size={9} /> : <span className="block h-2 w-2 rounded-full bg-line" />}</span>
                    <span>
                      <span className="font-mono text-ink-soft">{formatDate(h.date)}</span>
                      <br />
                      {h.text}
                    </span>
                  </li>
                ))}
              </ol>
              <button type="button" className={`${BTN.ghost} mt-3`} onClick={() => setTab('historial')}>Ver historial completo</button>
            </Card>
          </div>
        </div>
      )}

      {dialog?.kind === 'assign' && (
        <Modal
          title={req.analyst ? 'Reasignar analista' : 'Asignar analista'}
          variant="form"
          confirmLabel="Asignar"
          onClose={() => setDialog(null)}
          onConfirm={() => run({ kind: 'assign', id: req.id, analyst }, `${req.id} asignada a ${analyst}.`) && setDialog(null)}
        >
          <label htmlFor="analyst" className="block text-[12.5px] font-bold text-ink">Analista</label>
          <select id="analyst" value={analyst} onChange={(e) => setAnalyst(e.target.value)} className="mt-1.5 h-10 w-full rounded-ctl bg-surface px-3 text-[14px] text-ink shadow-[inset_0_0_0_1.5px_var(--line)]">
            {ANALYSTS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Modal>
      )}

      {dialog?.kind === 'evidence' && (
        <Modal
          title={`Completar "${dialog.subtask.name}"`}
          variant="form"
          confirmLabel="Marcar completa"
          onClose={() => setDialog(null)}
          onConfirm={() => {
            const t = dialog.subtask
            if (run({ kind: 'subtask', id: req.id, subtaskId: t.id, state: 'Completa', evidenceRef: evidence }, `Subtarea "${t.name}" completa.`)) setDialog(null)
          }}
        >
          <p className="mb-3">La referencia de evidencia es opcional, pero conviene registrarla: la bitácora del caso es la evidencia que exige el proceso.</p>
          <label htmlFor="evidence" className="block text-[12.5px] font-bold text-ink">Referencia de evidencia (opcional)</label>
          <input id="evidence" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Ej.: verificacion_identidad.pdf" className="mt-1.5 h-10 w-full rounded-ctl bg-surface px-3 text-[14px] text-ink shadow-[inset_0_0_0_1.5px_var(--line)] outline-none focus:shadow-[inset_0_0_0_1.5px_var(--brand-mid)]" />
        </Modal>
      )}

      {dialog?.kind === 'extension' && (
        <TextDialog
          title="Registrar prórroga"
          label="Motivo"
          min={MIN_EXTENSION_REASON}
          confirmLabel="Registrar prórroga"
          intro={`Suma ${state.params.arcopExtensionDays} días al vencimiento. Solo se puede registrar una prórroga por caso.`}
          validate={validateExtensionReason}
          onClose={() => setDialog(null)}
          onSubmit={(reason) => run({ kind: 'extension', id: req.id, reason }, 'Prórroga registrada; el semáforo se recalculó.') && setDialog(null)}
        />
      )}

      {dialog?.kind === 'reject' && (
        <TextDialog
          title={`¿Rechazar ${req.id} como improcedente?`}
          label="Fundamento"
          min={MIN_REJECTION_GROUND}
          confirmLabel="Rechazar como improcedente"
          destructive
          intro="Esta acción cierra el caso con el fundamento indicado y no se puede deshacer."
          validate={validateRejectionGround}
          onClose={() => setDialog(null)}
          onSubmit={(ground) => run({ kind: 'reject', id: req.id, ground }, `${req.id} cerrada como improcedente.`) && setDialog(null)}
        />
      )}

      {dialog?.kind === 'close' && (
        <Modal
          title={`¿Cerrar ${req.id}?`}
          confirmLabel="Cerrar caso"
          onClose={() => setDialog(null)}
          onConfirm={() => run({ kind: 'close', id: req.id }, `${req.id} cerrada.`) && setDialog(null)}
        >
          Se cerrará el caso y quedará registrado si cerró dentro o fuera de plazo (hoy es {formatDate(state.clock)}; vence el {formatDate(view.due)}). No se puede reabrir.
        </Modal>
      )}
    </div>
  )
}
