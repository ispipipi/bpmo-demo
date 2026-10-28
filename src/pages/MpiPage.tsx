import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { DataTable, type Column } from '../components/DataTable'
import { BlockedAction, BTN, Modal, useToast } from '../components/feedback'
import { ToneSegmented } from '../components/filters'
import { Meter } from '../components/Meter'
import { ProcessFicha } from '../components/ProcessFicha'
import { Field, inputClass, TabBar } from '../components/record'
import { StateShape, StatusChip } from '../components/StatusChip'
import { useLoading } from '../components/useLoading'
import {
  applyMpiOp,
  constanciaBlockers,
  MPI_STATES,
  mpiExpiry,
  validateItemChange,
  validateRefAndDate,
  type MpiOp,
} from '../domain/certification'
import { mpiCompliancePct } from '../domain/derive/mpi'
import { processTone } from '../domain/derive/tones'
import { applyFindingOp, HYPOTHETICAL_NOTICE, stageIndex, validateDescription } from '../domain/finding'
import { canWrite } from '../domain/permissions'
import type { Tone } from '../domain/tone'
import { FINDING_STAGES, type Finding, type MpiItem, type MpiItemState, type MpiStatus } from '../domain/types'
import { formatDate } from '../lib/dates'
import { useStore } from '../store/StoreProvider'

type Tab = 'mpi' | 'autodenuncia'
const ITEM_TONE: Record<MpiItemState, Tone> = { Cumple: 'ok', 'En progreso': 'warn', 'No cumple': 'crit', 'No aplica': 'na' }
const ITEM_CLASS: Record<MpiItemState, string> = {
  Cumple: 'bg-ok-soft text-ok-ink',
  'En progreso': 'bg-warn-soft text-warn-ink',
  'No cumple': 'bg-crit-soft text-crit-ink',
  'No aplica': 'bg-sunken text-ink-soft',
}
const CERT_STEPS: readonly MpiStatus[] = ['En preparación', 'Solicitada', 'Vigente']

export const SeverityLabel = ({ f }: { f: Finding }) =>
  f.severity ? <StatusChip tone={f.severity === 'Alta' ? 'crit' : 'warn'} label={`Gravedad ${f.severity}`} /> : <StatusChip tone="info" label="Sin evaluar" />

/** Diálogo con fecha y referencia (solicitud presentada, constancia vigente). */
function RefDialog({ title, intro, confirmLabel, refLabel, min, onSubmit, onClose }: { title: string; intro: string; confirmLabel: string; refLabel: string; min: string | null; onSubmit: (date: string, ref: string) => void; onClose: () => void }) {
  const { state } = useStore()
  const [date, setDate] = useState(state.clock)
  const [ref, setRef] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const errors = validateRefAndDate(state, { date, ref }, min)
  const err = (k: 'date' | 'ref') => (submitted ? errors[k] : undefined)
  return (
    <Modal title={title} variant="form" confirmLabel={confirmLabel} onClose={onClose} onConfirm={() => { setSubmitted(true); if (Object.keys(errors).length === 0) onSubmit(date, ref) }}>
      <p className="mb-4">{intro}</p>
      <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2">
        <Field id="ref-date" label="Fecha" required error={err('date')}>{(a) => <input {...a} type="date" value={date} max={state.clock} onChange={(e) => setDate(e.target.value)} className={`${inputClass(!!err('date'))} h-10 font-mono`} />}</Field>
        <Field id="ref-ref" label={refLabel} required error={err('ref')}>{(a) => <input {...a} value={ref} onChange={(e) => setRef(e.target.value)} className={`${inputClass(!!err('ref'))} h-10 font-mono`} />}</Field>
      </div>
    </Modal>
  )
}

export function NewFindingDialog({ originRef, initial, onClose }: { originRef: string | null; initial: string; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const [text, setText] = useState(initial)
  const [submitted, setSubmitted] = useState(false)
  const error = submitted ? validateDescription(text) : null
  return (
    <Modal
      title="Registrar hallazgo"
      variant="form"
      confirmLabel="Registrar hallazgo"
      onClose={onClose}
      onConfirm={() => {
        setSubmitted(true)
        if (validateDescription(text)) return
        const op = { kind: 'create' as const, origin: originRef ? ('Ítem MPI' as const) : ('Manual' as const), originRef, description: text }
        const r = applyFindingOp(state, op)
        if (!r.ok) return void toast({ kind: 'error', text: r.error })
        const created = r.value.data.findings.at(-1)
        dispatch({ type: 'finding', op })
        toast({ kind: 'success', text: `Hallazgo ${created?.id} registrado en estado Detectado.` })
        onClose()
        if (created) navigate(`/mpi/hallazgo/${created.id}`)
      }}
    >
      {originRef && <p className="mb-3">Origen: ítem <span className="font-mono font-bold">{originRef}</span>. El hallazgo alimenta el flujo de autodenuncia.</p>}
      <Field id="finding-desc" label="Descripción del hallazgo" required error={error ?? undefined}>
        {(a) => <textarea {...a} rows={4} value={text} onChange={(e) => setText(e.target.value)} className={`${inputClass(!!error)} p-3`} />}
      </Field>
    </Modal>
  )
}

function CertificationTab() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const writable = canWrite(state.role)
  const loading = useLoading(300)
  const mpi = state.data.mpi
  const pct = mpiCompliancePct(mpi)
  const tone = processTone('P20', state)
  const [filter, setFilter] = useState<'todos' | MpiItemState>('todos')
  const [editing, setEditing] = useState<{ itemId: string; state: MpiItemState } | null>(null)
  const [editRef, setEditRef] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editErrors, setEditErrors] = useState<Record<string, string | undefined>>({})
  const [dialog, setDialog] = useState<'requested' | 'constancia' | null>(null)
  const [finding, setFinding] = useState<MpiItem | null>(null)

  const counts = (s: MpiItemState) => mpi.items.filter((i) => i.state === s).length
  const applicable = mpi.items.filter((i) => i.state !== 'No aplica')
  const groups = useMemo(() => [...new Set(mpi.items.map((i) => i.group))], [mpi.items])
  const expiry = mpiExpiry(mpi)
  const blockers = constanciaBlockers(mpi)

  const run = (op: MpiOp, success: string): boolean => {
    const r = applyMpiOp(state, op)
    if (!r.ok) {
      toast({ kind: 'error', text: r.error })
      return false
    }
    dispatch({ type: 'mpi', op })
    toast({ kind: 'success', text: success })
    return true
  }

  const choose = (item: MpiItem, next: MpiItemState) => {
    if (next === 'Cumple' || next === 'No aplica') {
      setEditing({ itemId: item.id, state: next })
      setEditRef(next === 'Cumple' ? item.evidenceRef ?? '' : item.justification ?? '')
      setEditDate(state.clock)
      setEditErrors({})
    } else {
      setEditing(null)
      run({ kind: 'item', itemId: item.id, state: next }, `${item.id} ahora está "${next}".`)
    }
  }
  const save = (item: MpiItem) => {
    if (!editing) return
    const change = editing.state === 'Cumple' ? { state: editing.state, evidenceRef: editRef, date: editDate } : { state: editing.state, justification: editRef, date: editDate }
    const errors = validateItemChange(state, change)
    setEditErrors(errors)
    if (Object.keys(errors).length > 0) return
    if (run({ kind: 'item', itemId: item.id, ...change }, `${item.id} ahora está "${editing.state}".`)) setEditing(null)
  }

  return (
    <>
      <ProcessFicha module="/mpi#mpi" processes={['P20']} notice="Flujo hipotético a validar. Los textos de los 12 ítems son ilustrativos." />

      <section className="rounded-card bg-surface p-5 shadow-card min-[900px]:p-6" aria-label="Estado de la certificación">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-h1">Certificación MPI</h2>
              <StatusChip tone={tone} label={mpi.status} size="md" />
            </div>
            <ol className="mt-3 flex flex-wrap items-center gap-2 text-dense" aria-label="Estados de la certificación">
              {CERT_STEPS.map((s, i) => (
                <li key={s} className="flex items-center gap-2">
                  <span className={mpi.status === s ? 'font-bold text-brand-deep' : 'text-ink-soft'}>{s}</span>
                  {i < CERT_STEPS.length - 1 && <span aria-hidden="true" className="text-ink-faint">→</span>}
                </li>
              ))}
              <li className="ml-3 text-ink-soft">Vencimiento <span className="font-mono font-semibold text-ink">{expiry ? formatDate(expiry) : '—'}</span></li>
            </ol>
            {mpi.expedienteRef && <p className="mt-2 text-[15px] text-ink-soft">Expediente: <span className="font-mono">{mpi.expedienteRef}</span>{mpi.requestedAt && <> · presentado el <span className="font-mono">{formatDate(mpi.requestedAt)}</span></>}</p>}
            {mpi.constanciaRef && <p className="text-[15px] text-ink-soft">Constancia: <span className="font-mono">{mpi.constanciaRef}</span>{mpi.constanciaAt && <> · <span className="font-mono">{formatDate(mpi.constanciaAt)}</span></>}</p>}
          </div>
          <div className="min-w-[240px] max-w-[340px] flex-1">
            <div className="flex items-baseline justify-between"><span className="text-dense text-ink-soft">Ítems que cumplen</span><span className="text-kpi">{pct === null ? '—' : `${pct} %`}</span></div>
            <Meter value={pct ?? 0} tone={tone} label="Ítems que cumplen" />
            <p className="mt-2 text-[14.5px] text-ink-soft">{counts('Cumple')} de {applicable.length} · "No aplica" no cuenta en el denominador</p>
          </div>
          {writable && (
            <div className="flex min-w-[240px] flex-col gap-2">
              {mpi.status === 'En preparación' ? (
                <button type="button" className={BTN.primary} onClick={() => setDialog('requested')}>Registrar solicitud presentada</button>
              ) : (
                <p className="rounded-ctl bg-ok-soft px-3 py-2 text-[15px] font-semibold text-ok-ink">Solicitud presentada</p>
              )}
              {blockers.length === 0 ? (
                <button type="button" className={BTN.primary} onClick={() => setDialog('constancia')}>Registrar constancia vigente</button>
              ) : mpi.status === 'Vigente' ? null : (
                <BlockedAction label="Registrar constancia vigente" reasons={blockers} />
              )}
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-card bg-surface shadow-card" aria-label="Checklist de certificación">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <ToneSegmented
            label="Estado de los ítems"
            value={filter}
            onChange={(v) => setFilter(v as typeof filter)}
            options={[
              { value: 'todos', label: 'Todos', count: mpi.items.length },
              { value: 'No cumple', label: 'No cumple', count: counts('No cumple'), tone: 'crit' },
              { value: 'En progreso', label: 'En progreso', count: counts('En progreso'), tone: 'warn' },
              { value: 'Cumple', label: 'Cumple', count: counts('Cumple'), tone: 'ok' },
              { value: 'No aplica', label: 'No aplica', count: counts('No aplica'), tone: 'na' },
            ]}
          />
          <button type="button" className={`${BTN.ghost} text-brand`} onClick={() => setFilter('No cumple')}>Ver ítems críticos</button>
        </div>
        {loading ? (
          <div className="p-6 text-center text-dense text-ink-soft" aria-busy="true">Cargando…</div>
        ) : (
          groups.map((g) => {
            const items = mpi.items.filter((i) => i.group === g && (filter === 'todos' || i.state === filter))
            if (items.length === 0) return null
            return (
              <div key={g}>
                <h3 className="bg-sunken px-5 py-2.5 text-overline uppercase text-ink-soft">{g}</h3>
                {items.map((item) => (
                  <div key={item.id} className="border-t border-line-soft">
                    <div className="grid grid-cols-1 items-center gap-x-4 gap-y-2 px-5 py-3 min-[900px]:grid-cols-[72px_1fr_180px_150px]">
                      <span className="font-mono text-[15px] font-semibold">{item.id}</span>
                      <div className="min-w-0">
                        <div className="text-[16px]">{item.description}</div>
                        <div className="mt-0.5 font-mono text-[14px] text-ink-soft">
                          {item.state === 'No aplica' ? `Justificación: ${item.justification ?? '—'}` : item.evidenceRef ?? 'Sin evidencia'} {item.date ? formatDate(item.date) : '—'}
                        </div>
                      </div>
                      <span className="w-fit rounded-[6px] bg-surface px-2 py-0.5 text-[14px] font-semibold text-ink-soft shadow-[inset_0_0_0_1px_var(--line)]">{item.owner}</span>
                      <div className="flex items-center gap-2">
                        {writable ? (
                          <select aria-label={`Estado de ${item.id}`} value={editing?.itemId === item.id ? editing.state : item.state} onChange={(e) => choose(item, e.target.value as MpiItemState)} className={`h-7 cursor-pointer rounded-full px-2.5 text-label outline-none ${ITEM_CLASS[item.state]}`}>
                            {MPI_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : (
                          <span className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-label ${ITEM_CLASS[item.state]}`}><StateShape tone={ITEM_TONE[item.state]} size={9} />{item.state}</span>
                        )}
                        {writable && item.state === 'No cumple' && <button type="button" className={BTN.ghost} onClick={() => setFinding(item)}>Crear hallazgo</button>}
                      </div>
                    </div>
                    {editing?.itemId === item.id && (
                      <div className="mx-5 mb-3 rounded-ctl bg-brand-wash p-4 shadow-[inset_0_0_0_1px_var(--brand-soft)]">
                        <p className="text-[14.5px] font-bold text-brand-deep">{editing.state === 'Cumple' ? 'Cambiar a "Cumple" · referencia de evidencia obligatoria' : 'Cambiar a "No aplica" · justificación obligatoria'}</p>
                        <div className="mt-3 grid grid-cols-1 gap-3 min-[900px]:grid-cols-[1fr_160px_auto]">
                          <Field id={`edit-ref-${item.id}`} label={editing.state === 'Cumple' ? 'Referencia de evidencia' : 'Justificación'} error={editErrors.evidenceRef ?? editErrors.justification}>
                            {(a) => <input {...a} value={editRef} autoFocus onChange={(e) => setEditRef(e.target.value)} className={`${inputClass(!!(editErrors.evidenceRef ?? editErrors.justification))} h-10 font-mono`} />}
                          </Field>
                          <Field id={`edit-date-${item.id}`} label="Fecha" error={editErrors.date}>
                            {(a) => <input {...a} type="date" value={editDate} max={state.clock} onChange={(e) => setEditDate(e.target.value)} className={`${inputClass(!!editErrors.date)} h-10 font-mono`} />}
                          </Field>
                          <div className="flex items-end gap-2">
                            <button type="button" className={BTN.ghost} onClick={() => setEditing(null)}>Cancelar</button>
                            <button type="button" className={BTN.primary} onClick={() => save(item)}>Guardar</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          })
        )}
        {!loading && mpi.items.every((i) => filter !== 'todos' && i.state !== filter) && <p className="px-5 py-8 text-center text-dense text-ink-soft">Ningún ítem está en el estado "{filter}".</p>}
      </section>

      {dialog === 'requested' && (
        <RefDialog title="Registrar solicitud presentada" intro={'La certificación pasa a "Solicitada".'} confirmLabel="Registrar solicitud" refLabel="Referencia del expediente" min={null} onClose={() => setDialog(null)} onSubmit={(date, ref) => run({ kind: 'requested', date, ref }, 'Solicitud presentada registrada: la certificación quedó "Solicitada".') && setDialog(null)} />
      )}
      {dialog === 'constancia' && (
        <RefDialog title="Registrar constancia vigente" intro={'La certificación pasa a "Vigente" y vence 3 años después de la fecha de la constancia.'} confirmLabel="Registrar constancia" refLabel="Referencia de la constancia" min={mpi.requestedAt} onClose={() => setDialog(null)} onSubmit={(date, ref) => run({ kind: 'constancia', date, ref }, 'Constancia registrada: la certificación quedó "Vigente".') && setDialog(null)} />
      )}
      {finding && <NewFindingDialog originRef={finding.id} initial={`${finding.id} no cumple: ${finding.description}.`} onClose={() => setFinding(null)} />}
    </>
  )
}

function AutodenunciaTab() {
  const { state } = useStore()
  const writable = canWrite(state.role)
  const loading = useLoading(300)
  const [creating, setCreating] = useState(false)
  const findings = [...state.data.findings].sort((a, b) => Number(a.stage === 'Cerrado') - Number(b.stage === 'Cerrado') || b.id.localeCompare(a.id))
  const columns: Column<Finding>[] = [
    { key: 'id', header: 'ID', render: (f) => <Link to={`/mpi/hallazgo/${f.id}`} className="font-mono text-[15px] font-semibold text-ink hover:text-brand">{f.id}</Link> },
    { key: 'desc', header: 'Hallazgo', render: (f) => <span className="block max-w-[420px] truncate" title={f.description}>{f.description}</span> },
    { key: 'origin', header: 'Origen', render: (f) => <span className="text-ink-soft">{f.origin}{f.originRef && f.origin !== 'Evento E8' ? ` · ${f.originRef}` : ''}</span> },
    { key: 'detected', header: 'Detectado', align: 'right', render: (f) => <span className="font-mono text-[15px]">{formatDate(f.detectedAt)}</span> },
    { key: 'severity', header: 'Gravedad', render: (f) => <SeverityLabel f={f} /> },
    { key: 'stage', header: 'Etapa', render: (f) => <span className="inline-flex h-6 items-center whitespace-nowrap rounded-full bg-brand-soft px-2.5 text-label text-brand-deep">{stageIndex(f.stage) + 1}/{FINDING_STAGES.length} · {f.stage}</span> },
  ]
  return (
    <>
      <ProcessFicha module="/mpi#autodenuncia" processes={['P19']} notice={HYPOTHETICAL_NOTICE} />
      <section className="overflow-hidden rounded-card bg-surface shadow-card" aria-label="Hallazgos y autodenuncias">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-dense text-ink-soft">{state.data.findings.filter((f) => f.stage !== 'Cerrado').length} abiertos de {state.data.findings.length} hallazgos</p>
          {writable && <button type="button" className={BTN.primary} onClick={() => setCreating(true)}>Registrar hallazgo manual</button>}
        </div>
        <DataTable
          label="Hallazgos"
          columns={columns}
          rows={findings}
          rowKey={(f) => f.id}
          rowHref={(f) => `/mpi/hallazgo/${f.id}`}
          loading={loading}
          empty={{ title: 'Sin hallazgos', text: writable ? 'Registra un hallazgo manual o espera que lo detecte la sincronización.' : 'Aún no hay hallazgos registrados.' }}
          footer={`Mostrando 1–${findings.length} de ${findings.length}`}
        />
      </section>
      {creating && <NewFindingDialog originRef={null} initial="" onClose={() => setCreating(false)} />}
    </>
  )
}

export default function MpiPage() {
  const { state } = useStore()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'autodenuncia' ? 'autodenuncia' : 'mpi'
  const open = state.data.findings.filter((f) => f.stage !== 'Cerrado').length
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-h1">Certificación MPI y autodenuncia</h1>
      <TabBar
        tab={tab}
        onChange={(t) => setParams(t === 'mpi' ? {} : { tab: t }, { replace: true })}
        tabs={[
          { id: 'mpi', label: 'Certificación MPI' },
          { id: 'autodenuncia', label: `Autodenuncia · ${open} ${open === 1 ? 'abierta' : 'abiertas'}` },
        ]}
      />
      {tab === 'mpi' ? <CertificationTab /> : <AutodenunciaTab />}
    </div>
  )
}
