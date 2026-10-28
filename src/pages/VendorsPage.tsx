import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DataTable, type Column } from '../components/DataTable'
import { BTN, useToast } from '../components/feedback'
import { FilterSelect, ToneSegmented } from '../components/filters'
import { IconSearch } from '../components/Icons'
import { ProcessFicha } from '../components/ProcessFicha'
import { FieldsDialog, HistoryList } from '../components/record'
import { PanelPairs, SidePanel } from '../components/SidePanel'
import { StateShape, StatusChip } from '../components/StatusChip'
import { useLoading } from '../components/useLoading'
import { hasGuarantee, vendorDue } from '../domain/derive/sla'
import { canWrite } from '../domain/permissions'
import type { Tone } from '../domain/tone'
import type { Vendor } from '../domain/types'
import { AREAS } from '../domain/rat'
import { applyVendorOp, COUNTRIES, forcesInternational, MATURITIES, validateDpa, validateGuarantee, validateNewVendor, vendorStatus, type VendorOp } from '../domain/vendors'
import { formatDate } from '../lib/dates'
import { useStore } from '../store/StoreProvider'

type Dialog = 'dpa' | 'guarantee' | 'maturity' | 'contract' | 'add' | null
const TONE_ORDER: Record<Tone, number> = { crit: 0, warn: 1, ok: 2, info: 3, na: 3 }
const FILTROS = { 'sin-dpa': 'Sin DPA vigente', 'sin-garantia': 'Transferencia sin mecanismo de garantía' } as const

export default function VendorsPage() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const loading = useLoading()
  const writable = canWrite(state.role)
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('id')
  const filtro = params.get('filtro') as keyof typeof FILTROS | null
  const [q, setQ] = useState('')
  const [country, setCountry] = useState('todos')
  const [intl, setIntl] = useState('todos')
  const [tone, setTone] = useState<'todos' | Tone>('todos')
  const [dialog, setDialog] = useState<Dialog>(null)

  const rows = useMemo(
    () => state.data.vendors.map((v) => ({ v, st: vendorStatus(v, state) })).sort((a, b) => TONE_ORDER[a.st.tone] - TONE_ORDER[b.st.tone] || a.v.name.localeCompare(b.v.name)),
    [state],
  )
  const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const base = rows.filter(
    ({ v }) =>
      (q === '' || norm(v.name + v.id + v.category).includes(norm(q))) &&
      (country === 'todos' || v.country === country) &&
      (intl === 'todos' || (intl === 'si') === v.international) &&
      (filtro !== 'sin-dpa' || v.dpa !== 'Vigente') &&
      (filtro !== 'sin-garantia' || (v.international && !hasGuarantee(v))),
  )
  const shown = base.filter((r) => tone === 'todos' || r.st.tone === tone)
  const n = (t: Tone) => base.filter((r) => r.st.tone === t).length
  const countries = [...new Set(state.data.vendors.map((v) => v.country))].sort()
  const selected = state.data.vendors.find((v) => v.id === selectedId)
  const select = (id: string | null) => setParams(id ? { id } : {}, { replace: true })

  const run = (op: VendorOp, success: string): boolean => {
    const r = applyVendorOp(state, op)
    if (!r.ok) {
      toast({ kind: 'error', text: r.error })
      return false
    }
    dispatch({ type: 'vendor', op })
    toast({ kind: 'success', text: success })
    return true
  }

  const columns: Column<(typeof rows)[number]>[] = [
    { key: 'name', header: 'Proveedor', render: ({ v }) => <><div className="font-bold">{v.name}</div><div className="text-[12px] text-ink-soft">{v.category} · {v.area}</div></>, sort: (a, b) => a.v.name.localeCompare(b.v.name) },
    { key: 'country', header: 'País', render: ({ v }) => v.country },
    { key: 'intl', header: 'T. intl.', render: ({ v }) => <span className="font-bold">{v.international ? 'Sí' : 'No'}</span> },
    { key: 'dpa', header: 'DPA', render: ({ v }) => <span className={v.dpa === 'Vigente' ? '' : 'font-bold text-crit-ink'}>{v.dpa}</span> },
    {
      key: 'due',
      header: 'Vence',
      align: 'right',
      render: ({ v }) => {
        const due = vendorDue(v)
        return due ? <span className={`font-mono text-[13px] ${due < state.clock ? 'font-bold text-crit-ink' : ''}`}>{formatDate(due)}</span> : <span className="text-ink-faint">—</span>
      },
      sort: (a, b) => (vendorDue(a.v) ?? '9999').localeCompare(vendorDue(b.v) ?? '9999'),
    },
    { key: 'maturity', header: 'Madurez', render: ({ v }) => <span className="text-ink-soft">{v.maturity}</span> },
    {
      key: 'guarantee',
      header: 'Mecanismo de garantía',
      render: ({ v }) => (v.international ? v.guarantee ?? <span className="font-bold text-crit-ink">Sin definir</span> : <span className="text-ink-faint">—</span>),
    },
    { key: 'status', header: 'Estado', width: '190px', render: ({ st }) => <StatusChip tone={st.tone} label={st.label} /> },
  ]

  const missing = (v: Vendor) => v.dpa !== 'Vigente' || (v.international && !hasGuarantee(v))
  const st = selected ? vendorStatus(selected, state) : null
  const alertText = selected && st?.tone === 'crit'
    ? selected.dpa !== 'Vigente' && selected.international && !hasGuarantee(selected)
      ? 'Transferencia internacional sin DPA ni mecanismo de garantía definido.'
      : selected.dpa !== 'Vigente' ? 'No tiene un DPA vigente.' : selected.international && !hasGuarantee(selected) ? 'Transferencia internacional sin mecanismo de garantía definido.' : 'El contrato o el DPA está vencido.'
    : null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1">Proveedores y transferencias</h1>
        {writable && <button type="button" className={BTN.primary} onClick={() => setDialog('add')}>Agregar proveedor</button>}
      </div>
      <ProcessFicha module="/proveedores" processes={['P10', 'P17']} />

      <section className="overflow-hidden rounded-card bg-surface shadow-card" aria-label="Catastro de proveedores">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <label className="relative">
            <span className="sr-only">Buscar proveedor</span>
            <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar proveedor…" className="h-9 w-[240px] max-w-full rounded-ctl bg-surface pl-9 pr-3 text-[13px] shadow-[inset_0_0_0_1.5px_var(--line)] outline-none focus:shadow-[inset_0_0_0_1.5px_var(--brand-mid)]" />
          </label>
          <FilterSelect label="País" value={country} onChange={setCountry} options={[{ value: 'todos', label: 'Todos' }, ...countries.map((c) => ({ value: c, label: c }))]} />
          <FilterSelect label="Transf. intl." value={intl} onChange={setIntl} options={[{ value: 'todos', label: 'Todas' }, { value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }]} />
          <ToneSegmented
            label="Estado documental"
            value={tone}
            onChange={(v) => setTone(v as typeof tone)}
            options={[
              { value: 'todos', label: 'Todos', count: base.length },
              { value: 'crit', label: 'Rojo', count: n('crit'), tone: 'crit' },
              { value: 'warn', label: 'Amarillo', count: n('warn'), tone: 'warn' },
              { value: 'ok', label: 'Verde', count: n('ok'), tone: 'ok' },
            ]}
          />
          {filtro && filtro in FILTROS && <button type="button" className={BTN.ghost} onClick={() => setParams({}, { replace: true })}>Filtro: {FILTROS[filtro]} ✕</button>}
        </div>
        <DataTable
          label="Proveedores"
          columns={columns}
          rows={shown}
          rowKey={(r) => r.v.id}
          onRowClick={(r) => select(r.v.id)}
          isRowSelected={(r) => r.v.id === selectedId}
          loading={loading}
          empty={{ title: 'Ningún proveedor coincide con los filtros', text: 'Prueba con otra búsqueda o limpia los filtros.', action: <button type="button" className={BTN.secondary} onClick={() => { setQ(''); setCountry('todos'); setIntl('todos'); setTone('todos'); setParams({}, { replace: true }) }}>Limpiar filtros</button> }}
          footer={`Mostrando 1–${shown.length} de ${shown.length}`}
        />
      </section>

      {selected && st && (
        <SidePanel
          title={selected.name}
          subtitle={`${selected.category} · ${selected.area} · ${selected.country}`}
          chip={<StatusChip tone={st.tone} label={st.label} size="md" />}
          onClose={() => select(null)}
        >
          {alertText && <p role="alert" className="flex items-start gap-2 rounded-ctl bg-crit-soft px-3 py-2.5 text-dense text-crit-ink"><span className="mt-1"><StateShape tone="crit" size={10} /></span>{alertText}</p>}
          <PanelPairs
            pairs={[
              ['DPA', selected.dpa === 'Vigente' ? 'Vigente' : <span className="text-crit-ink">{selected.requested.dpa ? 'Sin DPA · solicitado' : 'Sin DPA'}</span>],
              ['Vence DPA', selected.dpaExpiresAt ? <span className="font-mono">{formatDate(selected.dpaExpiresAt)}</span> : '—'],
              ['Vence contrato', selected.contractExpiresAt ? <span className="font-mono">{formatDate(selected.contractExpiresAt)}</span> : '—'],
              ['Transferencia internacional', selected.international ? 'Sí' : 'No'],
              ['Mecanismo de garantía', selected.international ? selected.guarantee ?? <span className="text-crit-ink">{selected.requested.guarantee ? 'Sin definir · solicitado' : 'Sin definir'}</span> : '—'],
              ['Madurez', selected.maturity],
              ['Última revisión', selected.lastReviewAt ? <span className="font-mono">{formatDate(selected.lastReviewAt)}</span> : '—'],
            ]}
          />
          {writable && (
            <div>
              <div className="mb-2 text-overline text-ink-soft">ACCIONES</div>
              {missing(selected) && (
                <button type="button" className={`${BTN.primary} mb-3 w-full`} onClick={() => run({ kind: 'request', id: selected.id }, `Solicitud registrada: recordatorio simulado enviado a ${selected.area}.`)}>
                  Solicitar DPA o garantía (simulado)
                </button>
              )}
              <div className="grid grid-cols-2 gap-3">
                <button type="button" className={BTN.secondary} onClick={() => setDialog('dpa')}>Marcar DPA recibido</button>
                {selected.international && <button type="button" className={BTN.secondary} onClick={() => setDialog('guarantee')}>Definir garantía</button>}
                <button type="button" className={BTN.secondary} onClick={() => setDialog('maturity')}>Evaluar madurez</button>
                <button type="button" className={BTN.secondary} onClick={() => run({ kind: 'review', id: selected.id }, 'Revisión anual registrada con la fecha de demo.')}>Revisión anual</button>
                <button type="button" className={`${BTN.secondary} col-span-2`} onClick={() => setDialog('contract')}>Actualizar vencimiento de contrato</button>
              </div>
            </div>
          )}
          <div>
            <h3 className="mb-2 border-b border-line pb-2 text-[13.5px] font-bold text-brand-deep">Historial</h3>
            <HistoryList entries={selected.history} formatDate={formatDate} />
          </div>
        </SidePanel>
      )}

      {dialog === 'dpa' && selected && (
        <FieldsDialog
          title={`Marcar DPA recibido · ${selected.name}`}
          intro="El DPA pasa a Vigente con la fecha de vencimiento indicada."
          fields={[{ key: 'expiresAt', label: 'Vencimiento del DPA', kind: 'date', required: true }, { key: 'ref', label: 'Referencia del documento', kind: 'text', required: true, mono: true }]}
          validate={(v) => ({ ...validateDpa({ expiresAt: v.expiresAt ?? '', ref: v.ref ?? '' }) })}
          confirmLabel="Marcar DPA recibido"
          onClose={() => setDialog(null)}
          onSubmit={(v) => run({ kind: 'dpa', id: selected.id, expiresAt: v.expiresAt ?? '', ref: v.ref ?? '' }, 'DPA registrado como vigente.') && setDialog(null)}
        />
      )}
      {dialog === 'guarantee' && selected && (
        <FieldsDialog
          title={`Definir mecanismo de garantía · ${selected.name}`}
          fields={[{ key: 'text', label: 'Mecanismo de garantía', kind: 'text', required: true, placeholder: 'Ej.: Cláusulas contractuales tipo', hint: 'Mínimo 5 caracteres' }, { key: 'ref', label: 'Referencia', kind: 'text', required: true, mono: true }]}
          validate={(v) => ({ ...validateGuarantee({ text: v.text ?? '', ref: v.ref ?? '' }) })}
          confirmLabel="Definir garantía"
          onClose={() => setDialog(null)}
          onSubmit={(v) => run({ kind: 'guarantee', id: selected.id, text: v.text ?? '', ref: v.ref ?? '' }, 'Mecanismo de garantía definido: el estado documental se recalculó.') && setDialog(null)}
        />
      )}
      {dialog === 'maturity' && selected && (
        <FieldsDialog
          title={`Evaluar madurez · ${selected.name}`}
          fields={[{ key: 'level', label: 'Nivel de madurez', kind: 'select', required: true, options: MATURITIES.map((m) => ({ value: m, label: m })) }]}
          validate={(v) => (v.level ? {} : { level: 'Elige el nivel de madurez.' })}
          confirmLabel="Registrar evaluación"
          onClose={() => setDialog(null)}
          onSubmit={(v) => run({ kind: 'maturity', id: selected.id, level: v.level as 'Alta' }, `Madurez evaluada: ${v.level}.`) && setDialog(null)}
        />
      )}
      {dialog === 'contract' && selected && (
        <FieldsDialog
          title={`Actualizar vencimiento · ${selected.name}`}
          intro="Cambia la fecha de vencimiento del contrato y recalcula el semáforo."
          fields={[{ key: 'date', label: 'Vencimiento del contrato', kind: 'date', required: true }]}
          initial={{ date: selected.contractExpiresAt ?? '' }}
          validate={(v) => (/^\d{4}-\d{2}-\d{2}$/.test(v.date ?? '') ? {} : { date: 'Ingresa la fecha de vencimiento.' })}
          confirmLabel="Actualizar vencimiento"
          onClose={() => setDialog(null)}
          onSubmit={(v) => run({ kind: 'contract', id: selected.id, date: v.date ?? '' }, 'Vencimiento actualizado: el semáforo se recalculó.') && setDialog(null)}
        />
      )}
      {dialog === 'add' && (
        <FieldsDialog
          title="Agregar proveedor"
          intro="El proveedor nace sin DPA, por lo que aparece en rojo hasta completar su documentación."
          fields={[
            { key: 'name', label: 'Nombre', kind: 'text', required: true },
            { key: 'category', label: 'Categoría', kind: 'text', required: true },
            { key: 'area', label: 'Área', kind: 'select', required: true, options: AREAS.map((a) => ({ value: a, label: a })) },
            { key: 'country', label: 'País de alojamiento', kind: 'select', required: true, options: COUNTRIES.map((c) => ({ value: c, label: c })) },
            { key: 'international', label: 'Transferencia internacional', kind: 'checkbox' },
          ]}
          validate={(v) => ({ ...validateNewVendor({ name: v.name ?? '', category: v.category ?? '', area: v.area ?? '', country: v.country ?? '', international: v.international === 'true' }) })}
          extra={(v) => (forcesInternational(v.country ?? '') ? <p className="rounded-ctl bg-warn-soft px-3 py-2 text-[13px] text-warn-ink">Un país distinto de Chile implica transferencia internacional: se registrará como "Sí" y exigirá mecanismo de garantía.</p> : null)}
          confirmLabel="Agregar proveedor"
          onClose={() => setDialog(null)}
          onSubmit={(v) => run({ kind: 'add', input: { name: v.name ?? '', category: v.category ?? '', area: v.area ?? '', country: v.country ?? '', international: v.international === 'true' } }, `Proveedor ${v.name} agregado al catastro.`) && setDialog(null)}
        />
      )}
    </div>
  )
}
