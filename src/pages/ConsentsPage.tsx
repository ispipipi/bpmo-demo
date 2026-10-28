import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DataTable, type Column } from '../components/DataTable'
import { BTN, Modal, useToast } from '../components/feedback'
import { FilterSelect, ToneSegmented } from '../components/filters'
import { IconSearch } from '../components/Icons'
import { ProcessFicha } from '../components/ProcessFicha'
import { FieldsDialog, HistoryList } from '../components/record'
import { SidePanel } from '../components/SidePanel'
import { StatusChip } from '../components/StatusChip'
import { useLoading } from '../components/useLoading'
import { applyConsentOp, simulateCampaign, validateListSize, validateRevocation, type ConsentOp } from '../domain/consent'
import { consentExpiry, consentStatus, daysLeft, type ConsentStatus } from '../domain/derive/sla'
import { canWrite } from '../domain/permissions'
import type { Tone } from '../domain/tone'
import type { Consent, DemoState } from '../domain/types'
import { formatDate } from '../lib/dates'
import { formatNumber } from '../lib/format'
import { useStore } from '../store/StoreProvider'

const STATUS_TONE: Record<ConsentStatus, Tone> = { 'Por validar': 'warn', 'Con revocaciones': 'warn', Vigente: 'ok' }
const ORDER: Record<ConsentStatus, number> = { 'Por validar': 0, 'Con revocaciones': 1, Vigente: 2 }

type Dialog = { kind: 'revoke' | 'validate' } | { kind: 'campaign'; id: string } | null

function CampaignDialog({ state, initialId, onClose, onRun }: { state: DemoState; initialId: string; onClose: () => void; onRun: (op: ConsentOp) => void }) {
  const [id, setId] = useState(initialId)
  const [size, setSize] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState<{ enabled: number; without: number; size: number } | null>(null)
  const consent = state.data.consents.find((c) => c.id === id)
  const sizeError = submitted ? validateListSize(size) : null
  const idError = submitted && !consent ? 'Elige una finalidad.' : null
  return (
    <Modal
      title="Validar campaña (simulado)"
      variant="form"
      confirmLabel="Validar campaña"
      onClose={onClose}
      onConfirm={result ? undefined : () => {
        setSubmitted(true)
        if (!consent || validateListSize(size)) return
        const r = simulateCampaign(consent, Number(size))
        setResult({ ...r, size: Number(size) })
        onRun({ kind: 'campaign', id: consent.id, size: Number(size) })
      }}
    >
      <p className="mb-4">Calcula, con los consentimientos vigentes, cuántos contactos de una lista podrían recibir la comunicación. No envía nada.</p>
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="camp-id" className="block text-[14.5px] font-bold text-ink">Finalidad *</label>
          <select id="camp-id" value={id} onChange={(e) => { setId(e.target.value); setResult(null) }} className="mt-1.5 h-10 w-full rounded-ctl bg-surface px-3 text-[16px] text-ink shadow-[inset_0_0_0_1.5px_var(--line)]">
            <option value="">Elige…</option>
            {state.data.consents.map((c) => <option key={c.id} value={c.id}>{c.purpose} · {formatNumber(c.active)} vigentes</option>)}
          </select>
          {idError && <p className="mt-1.5 text-[14px] font-semibold text-crit-ink">{idError}</p>}
        </div>
        <div>
          <label htmlFor="camp-size" className="block text-[14.5px] font-bold text-ink">Tamaño de la lista de contactos *</label>
          <input id="camp-size" inputMode="numeric" value={size} onChange={(e) => { setSize(e.target.value); setResult(null) }} aria-invalid={sizeError ? true : undefined} className="mt-1.5 h-10 w-full rounded-ctl bg-surface px-3 font-mono text-[16px] text-ink shadow-[inset_0_0_0_1.5px_var(--line)]" />
          {sizeError && <p className="mt-1.5 text-[14px] font-semibold text-crit-ink">{sizeError}</p>}
        </div>
        {result && (
          <div role="status" className="rounded-ctl bg-brand-wash p-4">
            <p className="text-[14.5px] font-bold text-brand-deep">Validar campaña · lista de {formatNumber(result.size)} contactos</p>
            <p className="mt-1 text-body"><strong className="text-ok-ink">{formatNumber(result.enabled)}</strong> contactos habilitados, <strong className="text-crit-ink">{formatNumber(result.without)}</strong> sin consentimiento</p>
            <p className="mt-1 text-[14.5px] text-ink-soft">Resultado simulado. No se envía nada.</p>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default function ConsentsPage() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const loading = useLoading()
  const writable = canWrite(state.role)
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('id')
  const [q, setQ] = useState('')
  const [channel, setChannel] = useState('todos')
  const [status, setStatus] = useState<'todos' | ConsentStatus>('todos')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [tab, setTab] = useState<'mov' | 'hist'>('mov')

  const rows = useMemo(
    () => state.data.consents.map((c) => ({ c, status: consentStatus(c, state) })).sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.c.purpose.localeCompare(b.c.purpose)),
    [state],
  )
  const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const base = rows.filter((r) => (q === '' || norm(r.c.purpose + r.c.id).includes(norm(q))) && (channel === 'todos' || r.c.channel === channel))
  const shown = base.filter((r) => status === 'todos' || r.status === status)
  const count = (s: ConsentStatus) => base.filter((r) => r.status === s).length
  const channels = [...new Set(state.data.consents.map((c) => c.channel))].sort()
  const selected = state.data.consents.find((c) => c.id === selectedId)
  const select = (id: string | null) => setParams(id ? { id } : {}, { replace: true })

  const run = (op: ConsentOp, success: string): boolean => {
    const r = applyConsentOp(state, op)
    if (!r.ok) {
      toast({ kind: 'error', text: r.error })
      return false
    }
    dispatch({ type: 'consent', op })
    if (success) toast({ kind: 'success', text: success })
    return true
  }

  const columns: Column<(typeof rows)[number]>[] = [
    { key: 'purpose', header: 'Finalidad', render: ({ c }) => <><div className="font-bold">{c.purpose}</div><div className="font-mono text-[13.5px] text-ink-soft">{c.id}</div></>, sort: (a, b) => a.c.purpose.localeCompare(b.c.purpose) },
    { key: 'channel', header: 'Canal', render: ({ c }) => <span className="text-ink-soft">{c.channel}</span> },
    { key: 'active', header: 'Vigentes', align: 'right', render: ({ c }) => <span className="font-bold">{formatNumber(c.active)}</span>, sort: (a, b) => a.c.active - b.c.active },
    { key: 'revoked', header: 'Revocados', align: 'right', render: ({ c }) => <span className="text-ink-soft">{formatNumber(c.revoked)}</span>, sort: (a, b) => a.c.revoked - b.c.revoked },
    { key: 'validated', header: 'Últ. validación', align: 'right', render: ({ c, status: s }) => <span className={`font-mono text-[15px] ${s === 'Por validar' ? 'font-bold text-warn-ink' : ''}`}>{formatDate(c.lastValidatedAt)}</span>, sort: (a, b) => a.c.lastValidatedAt.localeCompare(b.c.lastValidatedAt) },
    { key: 'status', header: 'Estado', width: '170px', render: ({ status: s }) => <StatusChip tone={STATUS_TONE[s]} label={s} /> },
  ]

  const movements = (c: Consent) => [...c.movements].sort((a, b) => b.date.localeCompare(a.date))
  const expiry = selected ? consentExpiry(selected, state.params) : null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1">Consentimientos</h1>
        {writable && <button type="button" className={BTN.secondary} onClick={() => setDialog({ kind: 'campaign', id: selectedId ?? '' })}>Validar campaña (simulado)</button>}
      </div>
      <ProcessFicha module="/consentimientos" processes={['P8']} />

      <section className="overflow-hidden rounded-card bg-surface shadow-card" aria-label="Finalidades de consentimiento">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <label className="relative">
            <span className="sr-only">Buscar finalidad</span>
            <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar finalidad…" className="h-9 w-[240px] max-w-full rounded-ctl bg-surface pl-9 pr-3 text-[15px] shadow-[inset_0_0_0_1.5px_var(--line)] outline-none focus:shadow-[inset_0_0_0_1.5px_var(--brand-mid)]" />
          </label>
          <FilterSelect label="Canal" value={channel} onChange={setChannel} options={[{ value: 'todos', label: 'Todos' }, ...channels.map((c) => ({ value: c, label: c }))]} />
          <ToneSegmented
            label="Estado"
            value={status}
            onChange={(v) => setStatus(v as typeof status)}
            options={[
              { value: 'todos', label: `Todas`, count: base.length },
              { value: 'Por validar', label: 'Por validar', count: count('Por validar'), tone: 'warn' },
              { value: 'Con revocaciones', label: 'Con revocaciones', count: count('Con revocaciones'), tone: 'warn' },
              { value: 'Vigente', label: 'Vigente', count: count('Vigente'), tone: 'ok' },
            ]}
          />
        </div>
        <DataTable
          label="Consentimientos"
          columns={columns}
          rows={shown}
          rowKey={(r) => r.c.id}
          onRowClick={(r) => { setTab('mov'); select(r.c.id) }}
          isRowSelected={(r) => r.c.id === selectedId}
          loading={loading}
          empty={{ title: 'Ninguna finalidad coincide con los filtros', text: 'Prueba con otra búsqueda, canal o estado.', action: <button type="button" className={BTN.secondary} onClick={() => { setQ(''); setChannel('todos'); setStatus('todos') }}>Limpiar filtros</button> }}
          footer={`Mostrando 1–${shown.length} de ${shown.length}`}
        />
      </section>

      {selected && (
        <SidePanel
          title={selected.purpose}
          subtitle={<><span className="font-mono">{selected.id}</span> · {selected.channel}</>}
          chip={<StatusChip tone={STATUS_TONE[consentStatus(selected, state)]} label={consentStatus(selected, state)} size="md" />}
          onClose={() => select(null)}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-ctl bg-sunken p-3"><div className="text-[14.5px] text-ink-soft">Vigentes</div><div className="text-[24px] font-extrabold">{formatNumber(selected.active)}</div></div>
            <div className="rounded-ctl bg-sunken p-3"><div className="text-[14.5px] text-ink-soft">Revocados</div><div className="text-[24px] font-extrabold">{formatNumber(selected.revoked)}</div></div>
          </div>
          <p className="text-dense text-ink-soft">
            Última validación <span className="font-mono font-semibold text-ink">{formatDate(selected.lastValidatedAt)}</span>
            {expiry && <> · {daysLeft(expiry, state.clock) < 0 ? `venció hace ${-daysLeft(expiry, state.clock)} d` : `vence en ${daysLeft(expiry, state.clock)} d`}</>}
          </p>
          {writable && (
            <div className="grid grid-cols-2 gap-3">
              <button type="button" className={BTN.secondary} onClick={() => setDialog({ kind: 'revoke' })}>Registrar baja</button>
              <button type="button" className={BTN.secondary} onClick={() => run({ kind: 'validate', id: selected.id }, 'Validación registrada: la fecha de última validación se actualizó.')}>Marcar validación realizada</button>
              <button type="button" className={`${BTN.secondary} col-span-2`} onClick={() => setDialog({ kind: 'campaign', id: selected.id })}>Validar campaña (simulado)</button>
            </div>
          )}
          <div role="tablist" className="flex gap-5 border-b border-line">
            {([['mov', 'Últimos movimientos'], ['hist', 'Historial']] as const).map(([k, l]) => (
              <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px h-10 text-[15px] font-bold ${tab === k ? 'text-brand-deep' : 'text-ink-soft'}`} style={tab === k ? { boxShadow: 'inset 0 -2px 0 var(--brand)' } : undefined}>{l}</button>
            ))}
          </div>
          {tab === 'mov' ? (
            <ul className="flex flex-col gap-3">
              {movements(selected).map((m) => (
                <li key={m.id} className="flex gap-3 text-[15px]">
                  <span className={`grid h-6 w-6 flex-none place-items-center rounded-[6px] text-[16px] font-bold ${m.kind === 'Alta' ? 'bg-ok-soft text-ok-ink' : 'bg-crit-soft text-crit-ink'}`} aria-hidden="true">{m.kind === 'Alta' ? '+' : '−'}</span>
                  <span>
                    <span className="font-semibold">{m.kind === 'Alta' ? `Alta · ${m.holder}` : m.note}</span><br />
                    <span className="font-mono text-ink-soft">{formatDate(m.date)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <HistoryList entries={selected.history} formatDate={formatDate} />
          )}
        </SidePanel>
      )}

      {dialog?.kind === 'revoke' && selected && (
        <FieldsDialog
          title={`Registrar baja · ${selected.purpose}`}
          intro={`Resta de los ${formatNumber(selected.active)} titulares vigentes, suma a revocados y agrega un movimiento.`}
          fields={[
            { key: 'quantity', label: 'Cantidad de titulares', kind: 'number', required: true, hint: `Entre 1 y ${formatNumber(selected.active)}` },
            { key: 'reason', label: 'Motivo', kind: 'textarea', required: true },
          ]}
          validate={(v) => ({ ...validateRevocation(selected, v.quantity ?? '', v.reason ?? '') })}
          confirmLabel="Registrar baja"
          onClose={() => setDialog(null)}
          onSubmit={(v) => run({ kind: 'revoke', id: selected.id, quantity: Number(v.quantity), reason: v.reason ?? '' }, `Baja registrada: ${v.quantity} titulares.`) && setDialog(null)}
        />
      )}
      {dialog?.kind === 'campaign' && <CampaignDialog state={state} initialId={dialog.id} onClose={() => setDialog(null)} onRun={(op) => run(op, '')} />}
    </div>
  )
}
