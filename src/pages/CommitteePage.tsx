import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DataTable, type Column } from '../components/DataTable'
import { BTN, Modal, useToast } from '../components/feedback'
import { ToneSegmented } from '../components/filters'
import { IconInfo } from '../components/Icons'
import { ProcessFicha } from '../components/ProcessFicha'
import { Card, FieldsDialog, HistoryList } from '../components/record'
import { SidePanel } from '../components/SidePanel'
import { StatusChip } from '../components/StatusChip'
import { useLoading } from '../components/useLoading'
import { daysLeft } from '../domain/derive/sla'
import { committeeNoticeActive } from '../domain/derive/tones'
import { agreementStatus, applyCommitteeOp, dueAlreadyPassed, lastHeldSession, nextSessionOf, validateAgreement, validateConvocation, type AgreementStatus, type CommitteeOp } from '../domain/committee'
import { canWrite } from '../domain/permissions'
import { AREAS } from '../domain/rat'
import type { Tone } from '../domain/tone'
import type { Agreement } from '../domain/types'
import { formatDate } from '../lib/dates'
import { useStore } from '../store/StoreProvider'

const ST_TONE: Record<AgreementStatus, Tone> = { Vencido: 'crit', Pendiente: 'na', Cumplido: 'ok' }
const ORDER: Record<AgreementStatus, number> = { Vencido: 0, Pendiente: 1, Cumplido: 2 }
const OWNERS = [...AREAS.map((a) => `${a} ESVAL`), 'Comunicaciones ESVAL']

function PendingChip({ label }: { label: string }) {
  return <span className="inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full bg-sunken px-2.5 text-label text-ink-soft"><span className="h-2 w-2 rounded-full border-[1.5px] border-ink-faint" />{label}</span>
}

function AgendaDialog({ sessionId, onClose, run }: { sessionId: string; onClose: () => void; run: (op: CommitteeOp, success: string) => boolean }) {
  const { state } = useStore()
  const session = state.data.committee.sessions.find((x) => x.id === sessionId)
  const [item, setItem] = useState('')
  return (
    <Modal title="Editar agenda" variant="form" onClose={onClose}>
      <ol className="mb-4">
        {session?.agenda.map((a, i) => (
          <li key={`${a}-${i}`} className="flex items-center justify-between gap-3 border-t border-line-soft py-2 text-dense first:border-t-0">
            <span>{i + 1}. {a}</span>
            <button type="button" className={BTN.ghost} onClick={() => run({ kind: 'agendaRemove', sessionId, index: i }, 'Punto quitado de la agenda.')}>Quitar</button>
          </li>
        ))}
        {session?.agenda.length === 0 && <li className="text-dense text-ink-soft">La agenda está vacía.</li>}
      </ol>
      <label htmlFor="agenda-item" className="block text-[12.5px] font-bold text-ink">Nuevo punto</label>
      <div className="mt-1.5 flex gap-2">
        <input id="agenda-item" value={item} onChange={(e) => setItem(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && run({ kind: 'agendaAdd', sessionId, item }, 'Punto agregado a la agenda.')) setItem('') }} className="h-10 flex-1 rounded-ctl bg-surface px-3 text-[14px] text-ink shadow-[inset_0_0_0_1.5px_var(--line)]" />
        <button type="button" className={BTN.secondary} onClick={() => run({ kind: 'agendaAdd', sessionId, item }, 'Punto agregado a la agenda.') && setItem('')}>Agregar</button>
      </div>
    </Modal>
  )
}

export default function CommitteePage() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const loading = useLoading()
  const writable = canWrite(state.role)
  const committee = state.data.committee
  const next = nextSessionOf(committee)
  const held = committee.sessions.filter((x) => x.status === 'Realizada').sort((a, b) => b.date.localeCompare(a.date))
  const [filter, setFilter] = useState<'todos' | AgreementStatus>('todos')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'convene' | 'agenda' | 'agreement' | 'followUp' | null>(null)

  const run = (op: CommitteeOp, success: string): boolean => {
    const r = applyCommitteeOp(state, op)
    if (!r.ok) {
      toast({ kind: 'error', text: r.error })
      return false
    }
    dispatch({ type: 'committee', op })
    toast({ kind: 'success', text: success })
    return true
  }

  const rows = committee.agreements.map((a) => ({ a, st: agreementStatus(a, state.clock) })).sort((x, y) => ORDER[x.st] - ORDER[y.st] || x.a.dueAt.localeCompare(y.a.dueAt))
  const shown = rows.filter((r) => filter === 'todos' || r.st === filter)
  const count = (s: AgreementStatus) => rows.filter((r) => r.st === s).length
  const selected = committee.agreements.find((a) => a.id === selectedId)
  const lastFollow = (a: Agreement) => a.followUps.at(-1)
  const noticeOn = committeeNoticeActive(state)

  const columns: Column<(typeof rows)[number]>[] = [
    { key: 'id', header: 'ID', render: ({ a }) => <span className="font-mono text-[13px] font-semibold">{a.id}</span> },
    {
      key: 'desc',
      header: 'Acuerdo',
      render: ({ a }) => (
        <div className="max-w-[360px] whitespace-normal">
          <div className="text-[13.5px]">{a.description}</div>
          <div className="text-[12px] text-ink-soft">{a.status === 'Cumplido' ? `Cumplido ${formatDate(a.doneAt ?? '')}` : lastFollow(a) ? `Último seguimiento ${formatDate(lastFollow(a)!.date)} · "${lastFollow(a)!.text}"` : 'Sin seguimientos'}</div>
        </div>
      ),
    },
    { key: 'owner', header: 'Responsable', render: ({ a }) => <span className="rounded-[6px] bg-surface px-2 py-0.5 text-[12px] font-semibold text-ink-soft shadow-[inset_0_0_0_1px_var(--line)]">{a.owner}</span> },
    { key: 'due', header: 'Comprometido', align: 'right', render: ({ a, st }) => <span className={`font-mono text-[13px] ${st === 'Vencido' ? 'font-bold text-crit-ink' : ''}`}>{formatDate(a.dueAt)}</span>, sort: (x, y) => x.a.dueAt.localeCompare(y.a.dueAt) },
    { key: 'status', header: 'Estado', width: '130px', render: ({ st }) => (st === 'Pendiente' ? <PendingChip label="Pendiente" /> : <StatusChip tone={ST_TONE[st]} label={st} />) },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1">{committee.name}</h1>
          <p className="text-[15px] text-ink-soft">Periodicidad {committee.periodicity.toLowerCase()} · {held.length} sesiones realizadas</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {writable && <button type="button" className={BTN.secondary} onClick={() => setDialog('agreement')}>Registrar acuerdo</button>}
          {next && (
            <button type="button" className={BTN.primary} onClick={() => { if (writable) dispatch({ type: 'committee', op: { kind: 'acta', sessionId: next.id } }); navigate(`/comites/acta/${next.id}`) }}>
              {writable ? 'Generar acta de la sesión' : 'Ver acta de la próxima sesión'}
            </button>
          )}
        </div>
      </div>
      <ProcessFicha module="/comites" processes={['P9']} />

      <div className="grid grid-cols-1 gap-5 min-[1200px]:grid-cols-[1fr_340px]">
        <section className="overflow-hidden rounded-card bg-surface shadow-card" aria-label="Acuerdos">
          <div className="flex flex-wrap items-center gap-4 p-4">
            <h2 className="text-h3">Acuerdos</h2>
            <ToneSegmented
              label="Estado de los acuerdos"
              value={filter}
              onChange={(v) => setFilter(v as typeof filter)}
              options={[
                { value: 'todos', label: 'Todos', count: rows.length },
                { value: 'Vencido', label: 'Vencidos', count: count('Vencido'), tone: 'crit' },
                { value: 'Pendiente', label: 'Pendientes', count: count('Pendiente') },
                { value: 'Cumplido', label: 'Cumplidos', count: count('Cumplido'), tone: 'ok' },
              ]}
            />
          </div>
          <DataTable
            label="Acuerdos del comité"
            columns={columns}
            rows={shown}
            rowKey={(r) => r.a.id}
            onRowClick={(r) => setSelectedId(r.a.id)}
            isRowSelected={(r) => r.a.id === selectedId}
            loading={loading}
            empty={{ title: 'Sin acuerdos', text: filter === 'todos' ? 'Aún no se registran acuerdos. Registra el primero tras la próxima sesión.' : 'Ningún acuerdo está en ese estado.' }}
          />
        </section>

        <div className="flex flex-col gap-5">
          {next && (
            <section className="rounded-card p-5 shadow-card" style={{ background: noticeOn ? 'radial-gradient(640px 220px at 0 0, var(--warn-soft), transparent 70%), var(--surface)' : 'var(--surface)' }} aria-label="Próxima sesión">
              <div className="flex items-center justify-between">
                <h2 className="text-overline text-ink-soft">PRÓXIMA SESIÓN</h2>
                <StatusChip tone={noticeOn ? 'warn' : 'ok'} label={`En ${daysLeft(next.date, state.clock)} días`} />
              </div>
              <p className="mt-3 font-mono text-[22px] font-semibold">{formatDate(next.date)}{next.convocation ? ` · ${next.convocation.time}` : ''}</p>
              <p className="mt-1 text-dense text-ink-soft">{next.convocation ? `Convocatoria registrada (simulada): ${next.convocation.place}` : 'Convocatoria no registrada'}</p>
              {next.convocation && <p className="text-dense text-ink-soft">Asistentes: {next.convocation.attendees}</p>}
              <h3 className="mt-3 text-[13px] font-bold">Agenda</h3>
              <ol className="mt-1">{next.agenda.map((a, i) => <li key={i} className="border-t border-line-soft py-2 text-dense">{i + 1}. {a}</li>)}</ol>
              {writable && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button type="button" className={BTN.primary} onClick={() => setDialog('convene')}>Registrar convocatoria</button>
                  <button type="button" className={BTN.secondary} onClick={() => setDialog('agenda')}>Editar agenda</button>
                </div>
              )}
            </section>
          )}
          <Card title="Sesiones anteriores">
            {held.length === 0 ? <p className="text-dense text-ink-soft">Aún no hay sesiones realizadas.</p> : (
              <ul>
                {held.map((x) => (
                  <li key={x.id} className="flex items-center justify-between border-t border-line-soft py-2.5 first:border-t-0">
                    <span className="font-mono text-[13px]">{formatDate(x.date)}</span>
                    <Link to={`/comites/acta/${x.id}`} className="text-label">Ver acta</Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {selected && (
        <SidePanel title={selected.id} subtitle={selected.description} chip={(() => { const st = agreementStatus(selected, state.clock); return st === 'Pendiente' ? <PendingChip label="Pendiente" /> : <StatusChip tone={ST_TONE[st]} label={st} size="md" /> })()} onClose={() => setSelectedId(null)}>
          <dl className="text-dense">
            <div className="flex justify-between border-t border-line-soft py-2.5"><dt className="text-ink-soft">Responsable</dt><dd className="font-bold">{selected.owner}</dd></div>
            <div className="flex justify-between border-t border-line-soft py-2.5"><dt className="text-ink-soft">Comprometido</dt><dd className="font-mono font-bold">{formatDate(selected.dueAt)}</dd></div>
            <div className="flex justify-between border-t border-line-soft py-2.5"><dt className="text-ink-soft">Sesión</dt><dd className="font-mono">{selected.sessionId}</dd></div>
          </dl>
          {writable && (
            <div className="grid grid-cols-2 gap-3">
              <button type="button" className={BTN.secondary} onClick={() => setDialog('followUp')}>Registrar seguimiento</button>
              {selected.status === 'Pendiente' ? (
                <button type="button" className={BTN.primary} onClick={() => run({ kind: 'status', id: selected.id, status: 'Cumplido' }, `${selected.id} marcado como cumplido.`)}>Marcar cumplido</button>
              ) : (
                <button type="button" className={BTN.secondary} onClick={() => run({ kind: 'status', id: selected.id, status: 'Pendiente' }, `${selected.id} vuelve a pendiente.`)}>Volver a pendiente</button>
              )}
            </div>
          )}
          <div>
            <h3 className="mb-2 border-b border-line pb-2 text-[13.5px] font-bold text-brand-deep">Seguimientos</h3>
            {selected.followUps.length === 0 ? <p className="text-dense text-ink-soft">Sin seguimientos.</p> : <HistoryList entries={selected.followUps.map((f) => ({ date: f.date, actor: 'Analista PMO', text: f.text }))} formatDate={formatDate} />}
          </div>
        </SidePanel>
      )}

      {dialog === 'convene' && next && (
        <FieldsDialog
          title="Registrar convocatoria (simulada)"
          intro="Registra la convocatoria de la próxima sesión. No se envía ningún correo."
          fields={[
            { key: 'date', label: 'Fecha', kind: 'date', required: true, min: state.clock },
            { key: 'time', label: 'Hora', kind: 'text', required: true, placeholder: '10:00', mono: true },
            { key: 'place', label: 'Lugar o enlace', kind: 'text', required: true },
            { key: 'attendees', label: 'Asistentes por área', kind: 'text', required: true, placeholder: 'Legal, TI, RRHH, Marketing' },
          ]}
          initial={{ date: next.date, time: next.convocation?.time ?? '10:00', place: next.convocation?.place ?? '', attendees: next.convocation?.attendees ?? '' }}
          validate={(v) => ({ ...validateConvocation(state, { date: v.date ?? '', time: v.time ?? '', place: v.place ?? '', attendees: v.attendees ?? '' }) })}
          confirmLabel="Registrar convocatoria"
          onClose={() => setDialog(null)}
          onSubmit={(v) => run({ kind: 'convene', sessionId: next.id, date: v.date ?? '', time: v.time ?? '', place: v.place ?? '', attendees: v.attendees ?? '' }, 'Convocatoria registrada (simulada); no se envió correo.') && setDialog(null)}
        />
      )}
      {dialog === 'agenda' && next && <AgendaDialog sessionId={next.id} onClose={() => setDialog(null)} run={run} />}
      {dialog === 'agreement' && (
        <FieldsDialog
          title="Registrar acuerdo"
          intro={`Se asocia a la sesión del ${formatDate((lastHeldSession(committee) ?? next)?.date ?? state.clock)}.`}
          fields={[
            { key: 'description', label: 'Descripción', kind: 'textarea', required: true },
            { key: 'owner', label: 'Responsable (área)', kind: 'select', required: true, options: OWNERS.map((o) => ({ value: o, label: o })) },
            { key: 'dueAt', label: 'Fecha comprometida', kind: 'date', required: true },
          ]}
          validate={(v) => ({ ...validateAgreement({ description: v.description ?? '', owner: v.owner ?? '', dueAt: v.dueAt ?? '' }) })}
          extra={(v) => (dueAlreadyPassed(v.dueAt ?? '', state.clock) ? <p className="flex items-start gap-2 rounded-ctl bg-warn-soft px-3 py-2 text-[13px] text-warn-ink"><IconInfo size={15} className="mt-0.5 flex-none" /> La fecha ya pasó: el acuerdo quedará vencido desde el inicio. Se permite igualmente.</p> : null)}
          confirmLabel="Registrar acuerdo"
          onClose={() => setDialog(null)}
          onSubmit={(v) => run({ kind: 'agreement', description: v.description ?? '', owner: v.owner ?? '', dueAt: v.dueAt ?? '' }, 'Acuerdo registrado.') && setDialog(null)}
        />
      )}
      {dialog === 'followUp' && selected && (
        <FieldsDialog
          title={`Registrar seguimiento · ${selected.id}`}
          intro="Anota lo que informó el responsable tras consultarle."
          fields={[{ key: 'text', label: 'Seguimiento', kind: 'textarea', required: true, hint: 'Mínimo 5 caracteres' }]}
          validate={(v) => ((v.text ?? '').trim().length >= 5 ? {} : { text: 'El seguimiento debe tener al menos 5 caracteres.' })}
          confirmLabel="Registrar seguimiento"
          onClose={() => setDialog(null)}
          onSubmit={(v) => run({ kind: 'followUp', id: selected.id, text: v.text ?? '' }, 'Seguimiento registrado.') && setDialog(null)}
        />
      )}
    </div>
  )
}
