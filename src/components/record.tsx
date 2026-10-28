import { useState, type ReactNode } from 'react'
import { Modal } from './feedback'
import { StateShape } from './StatusChip'

export const Meta = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-[11.5px] font-bold uppercase tracking-[0.04em] text-ink-soft">{label}</dt>
    <dd className="mt-1 text-[14px] font-semibold">{children}</dd>
  </div>
)

export const Card = ({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) => (
  <section className="rounded-card bg-surface p-5 shadow-card">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-h3">{title}</h2>
      {aside}
    </div>
    {children}
  </section>
)

/** Pestañas Detalle / Historial de todo registro (MD §6 convenciones). */
export function TabBar<T extends string = 'detalle' | 'historial'>({
  tab,
  onChange,
  tabs = [
    { id: 'detalle', label: 'Detalle' },
    { id: 'historial', label: 'Historial' },
  ] as unknown as { id: T; label: string }[],
}: {
  tab: T
  onChange: (t: T) => void
  tabs?: { id: T; label: string }[]
}) {
  return (
    <div role="tablist" aria-label="Secciones" className="flex gap-6 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={tab === t.id}
          onClick={() => onChange(t.id)}
          className={`-mb-px h-11 text-[14px] font-bold ${tab === t.id ? 'text-brand-deep' : 'text-ink-soft hover:text-ink'}`}
          style={tab === t.id ? { boxShadow: 'inset 0 -2px 0 var(--brand)' } : undefined}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function HistoryList({ entries, formatDate }: { entries: readonly { date: string; actor: string; text: string }[]; formatDate: (d: string) => string }) {
  return (
    <ol className="flex flex-col">
      {[...entries].reverse().map((h, i) => (
        <li key={i} className="flex gap-4 border-t border-line-soft py-2.5 first:border-t-0">
          <span className="w-[88px] flex-none font-mono text-[13px] text-ink-soft">{formatDate(h.date)}</span>
          <span className="text-dense"><strong className="font-semibold">{h.actor}</strong> · {h.text}</span>
        </li>
      ))}
    </ol>
  )
}

/** Modal de texto con mínimo de caracteres y contador ("Motivo · 6/10 mín."). */
export function TextDialog({
  title,
  label,
  min,
  confirmLabel,
  destructive,
  intro,
  validate,
  onSubmit,
  onClose,
}: {
  title: string
  label: string
  min: number
  confirmLabel: string
  destructive?: boolean
  intro?: ReactNode
  validate: (t: string) => string | null
  onSubmit: (t: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [touched, setTouched] = useState(false)
  const error = touched ? validate(text) : null
  return (
    <Modal
      title={title}
      variant="form"
      destructive={destructive}
      confirmLabel={confirmLabel}
      onClose={onClose}
      onConfirm={() => {
        setTouched(true)
        if (validate(text) === null) onSubmit(text.trim())
      }}
    >
      {intro && <p className="mb-3">{intro}</p>}
      <label className="block text-[12.5px] font-bold text-ink" htmlFor="text-dialog">
        {label} · <span className={text.trim().length >= min ? 'text-ok-ink' : ''}>{Math.min(text.trim().length, 999)}/{min} mín.</span>
      </label>
      <textarea
        id="text-dialog"
        value={text}
        rows={4}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => setTouched(true)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'text-dialog-error' : undefined}
        className="mt-1.5 w-full rounded-ctl bg-surface p-3 text-[14px] text-ink shadow-[inset_0_0_0_1.5px_var(--line)] outline-none focus:shadow-[inset_0_0_0_1.5px_var(--brand-mid)]"
        style={error ? { boxShadow: 'inset 0 0 0 1.5px var(--crit)' } : undefined}
      />
      {error && (
        <p id="text-dialog-error" className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-crit-ink">
          <StateShape tone="crit" size={9} /> {error}
        </p>
      )}
    </Modal>
  )
}

/** Campo de formulario con etiqueta, ayuda y error asociado (spec §C.4). */
export function Field({ id, label, error, hint, required, children }: { id: string; label: string; error?: string; hint?: string; required?: boolean; children: (a: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode }) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div>
      <label htmlFor={id} className="block text-[12.5px] font-bold text-ink">{label}{required && ' *'}</label>
      <div className="mt-1.5">{children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}</div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-[12px] font-semibold text-crit-ink"><span className="mt-1"><StateShape tone="crit" size={9} /></span>{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[12.5px] text-ink-soft">{hint}</p>
      ) : null}
    </div>
  )
}

export const inputClass = (invalid?: boolean) =>
  `w-full rounded-ctl bg-surface px-3 text-[14px] text-ink outline-none ${
    invalid ? 'shadow-[inset_0_0_0_1.5px_var(--crit)]' : 'shadow-[inset_0_0_0_1.5px_var(--line)]'
  } focus:shadow-[inset_0_0_0_1.5px_var(--brand-mid)]`

export type FieldDef = {
  key: string
  label: string
  kind: 'text' | 'date' | 'select' | 'textarea' | 'checkbox' | 'number'
  options?: readonly { value: string; label: string }[]
  placeholder?: string
  mono?: boolean
  hint?: string
  required?: boolean
  max?: string
  min?: string
  disabled?: boolean
}

export type Values = Record<string, string>

/** Modal de formulario: campos declarativos, validación en línea al enviar y errores asociados a cada campo. */
export function FieldsDialog({
  title,
  intro,
  fields,
  initial,
  validate,
  confirmLabel,
  destructive,
  extra,
  onSubmit,
  onClose,
}: {
  title: string
  intro?: ReactNode
  fields: readonly FieldDef[]
  initial?: Values
  validate: (v: Values) => Record<string, string | undefined>
  confirmLabel: string
  destructive?: boolean
  extra?: (v: Values) => ReactNode
  onSubmit: (v: Values) => void
  onClose: () => void
}) {
  const [values, setValues] = useState<Values>(() => Object.fromEntries(fields.map((f) => [f.key, initial?.[f.key] ?? ''])))
  const [submitted, setSubmitted] = useState(false)
  const errors = validate(values)
  const set = (k: string, v: string) => setValues((x) => ({ ...x, [k]: v }))
  return (
    <Modal
      title={title}
      variant="form"
      destructive={destructive}
      confirmLabel={confirmLabel}
      onClose={onClose}
      onConfirm={() => {
        setSubmitted(true)
        if (Object.values(errors).every((e) => !e)) onSubmit(values)
      }}
    >
      {intro && <p className="mb-4">{intro}</p>}
      <div className="flex flex-col gap-4">
        {fields.map((f) => {
          const error = submitted ? errors[f.key] : undefined
          if (f.kind === 'checkbox') {
            return (
              <label key={f.key} className="flex items-center gap-2 text-dense font-semibold text-ink">
                <input type="checkbox" checked={values[f.key] === 'true'} disabled={f.disabled} onChange={(e) => set(f.key, e.target.checked ? 'true' : '')} /> {f.label}
                {f.hint && <span className="text-[12.5px] font-normal text-ink-soft">{f.hint}</span>}
              </label>
            )
          }
          return (
            <Field key={f.key} id={`fd-${f.key}`} label={f.label} required={f.required} hint={f.hint} error={error}>
              {(a) =>
                f.kind === 'select' ? (
                  <select {...a} value={values[f.key]} disabled={f.disabled} onChange={(e) => set(f.key, e.target.value)} className={`${inputClass(!!error)} h-10`}>
                    <option value="">Elige…</option>
                    {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.kind === 'textarea' ? (
                  <textarea {...a} rows={3} value={values[f.key]} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} className={`${inputClass(!!error)} p-3`} />
                ) : (
                  <input {...a} type={f.kind === 'number' ? 'text' : f.kind} inputMode={f.kind === 'number' ? 'numeric' : undefined} value={values[f.key]} placeholder={f.placeholder} min={f.min} max={f.max} onChange={(e) => set(f.key, e.target.value)} className={`${inputClass(!!error)} h-10 ${f.mono || f.kind === 'date' || f.kind === 'number' ? 'font-mono' : ''}`} />
                )
              }
            </Field>
          )
        })}
        {extra?.(values)}
      </div>
    </Modal>
  )
}
