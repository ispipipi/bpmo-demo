import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BTN, Modal, useToast } from '../components/feedback'
import { IconInfo } from '../components/Icons'
import { StateShape } from '../components/StatusChip'
import { DEFAULT_PARAMS, PARAM_SPECS, parseParams, type ParamErrors } from '../domain/params'
import type { Params } from '../domain/types'
import { useStore } from '../store/StoreProvider'

const KEYS = Object.keys(PARAM_SPECS) as (keyof Params)[]
const UNIT: Record<keyof Params, string> = {
  arcopDays: 'días corridos',
  arcopExtensionDays: 'días',
  dueSoonDays: 'días restantes',
  ratValidationDays: 'días',
  ratReviewDays: 'días',
  vendorNoticeDays: 'días',
  committeeNoticeDays: 'días',
  consentValidityDays: 'días',
}
const TITLE: Record<keyof Params, string> = {
  arcopDays: 'Plazo de respuesta ARCOP',
  arcopExtensionDays: 'Prórroga ARCOP',
  dueSoonDays: 'Umbral "por vencer"',
  ratValidationDays: 'Plazo interno de validación de solicitud RAT',
  ratReviewDays: 'Periodicidad de la revisión del RAT',
  vendorNoticeDays: 'Aviso de vencimiento de contrato o DPA',
  committeeNoticeDays: 'Aviso de próximo comité',
  consentValidityDays: 'Vigencia de la validación de un consentimiento',
}

const toForm = (p: Params): Record<keyof Params, string> => Object.fromEntries(KEYS.map((k) => [k, String(p[k])])) as Record<keyof Params, string>

export default function ParamsPage() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const [form, setForm] = useState(() => toForm(state.params))
  const [touched, setTouched] = useState<Partial<Record<keyof Params, boolean>>>({})
  const [confirmReset, setConfirmReset] = useState(false)

  const parsed = parseParams(form)
  const errors: ParamErrors = parsed.ok ? {} : parsed.error
  const dirty = KEYS.some((k) => form[k].trim() !== String(state.params[k]))
  const hasErrors = !parsed.ok

  const save = () => {
    setTouched(Object.fromEntries(KEYS.map((k) => [k, true])))
    if (!parsed.ok) return
    dispatch({ type: 'setParams', params: parsed.value })
    toast({ kind: 'success', text: 'Parámetros guardados: los semáforos y las alertas se recalcularon.' })
  }

  return (
    <div className="flex max-w-[760px] flex-col gap-5">
      <Link to="/alertas" className="inline-flex w-fit text-label text-brand">← Volver a Alertas y SLA</Link>
      <div>
        <h1 className="text-h1">Parámetros</h1>
        <p className="text-[15px] text-ink-soft">Al guardar se recalculan todos los semáforos y alertas.</p>
      </div>
      <p className="flex items-center gap-2 rounded-ctl bg-warn-soft px-4 py-3 text-dense font-semibold text-warn-ink"><IconInfo size={16} className="flex-none" /> Los valores por defecto son de demostración y deben validarse con el equipo legal de H2D.</p>

      <form className="rounded-card bg-surface shadow-card" onSubmit={(e) => { e.preventDefault(); save() }} noValidate>
        {KEYS.map((k) => {
          const spec = PARAM_SPECS[k]
          const error = touched[k] || form[k].trim() !== String(state.params[k]) ? errors[k] : undefined
          return (
            <div key={k} className="grid grid-cols-1 items-center gap-3 border-b border-line-soft px-5 py-4 min-[640px]:grid-cols-[1fr_260px]">
              <div>
                <label htmlFor={`p-${k}`} className="block text-[14.5px] font-bold">{TITLE[k]}</label>
                <div className="text-[12.5px] text-ink-soft">Entero {spec.min}–{spec.max}</div>
              </div>
              <div>
                <div className="flex items-center gap-3 min-[640px]:justify-end">
                  <input
                    id={`p-${k}`}
                    inputMode="numeric"
                    value={form[k]}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `p-${k}-error` : undefined}
                    onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                    onBlur={() => setTouched((t) => ({ ...t, [k]: true }))}
                    className={`h-10 w-[84px] rounded-ctl bg-surface px-3 text-right font-mono text-[14px] font-semibold outline-none ${error ? 'shadow-[inset_0_0_0_1.5px_var(--crit)]' : 'shadow-[inset_0_0_0_1.5px_var(--line)]'} focus:shadow-[inset_0_0_0_1.5px_var(--brand-mid)]`}
                  />
                  <span className="w-[90px] text-dense text-ink-soft">{UNIT[k]}</span>
                </div>
                {error && <p id={`p-${k}-error`} className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-crit-ink min-[640px]:justify-end"><StateShape tone="crit" size={9} /> {error}</p>}
              </div>
            </div>
          )
        })}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <button type="button" className="text-[13px] font-bold text-ink-soft hover:text-ink" onClick={() => setConfirmReset(true)}>Restaurar valores por defecto</button>
          <div className="flex gap-3">
            <button type="button" className={BTN.secondary} onClick={() => { setForm(toForm(state.params)); setTouched({}) }} disabled={!dirty}>Cancelar</button>
            {hasErrors || !dirty ? (
              <button type="button" aria-disabled="true" className="inline-flex h-10 cursor-not-allowed items-center rounded-ctl bg-sunken px-[18px] text-[13.5px] font-bold text-ink-faint" onClick={() => setTouched(Object.fromEntries(KEYS.map((k) => [k, true])))}>Guardar parámetros</button>
            ) : (
              <button type="submit" className={BTN.primary}>Guardar parámetros</button>
            )}
          </div>
        </div>
      </form>
      <p className="text-[12.5px] text-ink-soft">"Guardar" se deshabilita mientras haya errores o no haya cambios. "Restaurar" pide confirmación.</p>

      {confirmReset && (
        <Modal
          title="¿Restaurar los valores por defecto?"
          confirmLabel="Restaurar"
          onClose={() => setConfirmReset(false)}
          onConfirm={() => {
            dispatch({ type: 'resetParams' })
            setForm(toForm(DEFAULT_PARAMS))
            setTouched({})
            setConfirmReset(false)
            toast({ kind: 'success', text: 'Parámetros restaurados a los valores por defecto.' })
          }}
        >
          Se reemplazan los 8 parámetros por los valores de demostración y se recalculan los semáforos y alertas.
        </Modal>
      )}
    </div>
  )
}
