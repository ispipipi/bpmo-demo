import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Field, inputClass } from '../components/record'
import { Modal, useToast } from '../components/feedback'
import { IconInfo } from '../components/Icons'
import { applyRatOp, AREAS, consentsOf, draftOf, LEGAL_BASES, requestWarnings, validateNewRequest, type FieldErrors, type NewRequestInput } from '../domain/rat'
import type { ActivityDraft, RatRequestType } from '../domain/types'
import { useStore } from '../store/StoreProvider'

const TYPES: readonly RatRequestType[] = ['Crear', 'Modificar', 'Eliminar']
const EMPTY: ActivityDraft = { name: '', area: '', purpose: '', legalBasis: '', dataCategories: '', holders: '', international: false }

export function RatNewRequest({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const [type, setType] = useState<RatRequestType>('Crear')
  const [activityId, setActivityId] = useState('')
  const [requester, setRequester] = useState('')
  const [description, setDescription] = useState('')
  const [draft, setDraft] = useState<ActivityDraft>(EMPTY)
  const [submitted, setSubmitted] = useState(false)

  const activities = state.data.rat.activities
  const input: NewRequestInput = { type, activityId: type === 'Crear' ? null : activityId || null, requester, description, proposal: type === 'Eliminar' ? null : { ...draft, area: draft.area || requester } }
  const errors: FieldErrors = useMemo(() => validateNewRequest(state, input), [state, type, activityId, requester, description, draft]) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = (k: keyof FieldErrors) => (submitted ? errors[k] : undefined)
  const warnings = requestWarnings(state, input)
  const blockedByConsents = type === 'Eliminar' && activityId ? consentsOf(state, activityId).length > 0 : false

  const pickType = (t: RatRequestType) => {
    setType(t)
    setActivityId('')
    setDraft(EMPTY)
    setSubmitted(false)
  }
  const pickActivity = (id: string) => {
    setActivityId(id)
    const a = activities.find((x) => x.id === id)
    setDraft(a && type === 'Modificar' ? draftOf(a) : EMPTY)
  }
  const set = <K extends keyof ActivityDraft>(k: K, v: ActivityDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const submit = () => {
    setSubmitted(true)
    if (Object.keys(errors).length > 0) return
    const op = { kind: 'create' as const, input }
    const r = applyRatOp(state, op)
    if (!r.ok) return void toast({ kind: 'error', text: r.error })
    const created = r.value.data.rat.requests.at(-1)
    dispatch({ type: 'rat', op })
    toast({ kind: 'success', text: `Solicitud ${created?.id} registrada en estado Recibida.` })
    onClose()
    if (created) navigate(`/rat/solicitud/${created.id}`)
  }

  return (
    <Modal title="Registrar nueva solicitud" variant="form" confirmLabel="Registrar solicitud" onClose={onClose} onConfirm={submit} confirmDisabled={blockedByConsents}>
      <p className="mb-4 text-[14px]">* obligatorio</p>
      <div className="flex flex-col gap-4">
        <div role="group" aria-label="Tipo de solicitud" className="flex rounded-ctl bg-sunken p-1">
          {TYPES.map((t) => (
            <button key={t} type="button" aria-pressed={type === t} onClick={() => pickType(t)} className={`h-9 flex-1 rounded-[7px] text-[15px] font-bold ${type === t ? 'bg-surface text-brand-deep shadow-card' : 'text-ink-soft'}`}>{t}</button>
          ))}
        </div>

        {type !== 'Crear' && (
          <Field id="rat-activity" label="Actividad" required error={shown('activityId') ?? (blockedByConsents ? errors.activityId : undefined)}>
            {(a) => (
              <select {...a} value={activityId} onChange={(e) => pickActivity(e.target.value)} className={`${inputClass(!!errors.activityId && (submitted || blockedByConsents))} h-10`}>
                <option value="">Elige una actividad…</option>
                {activities.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.name}</option>)}
              </select>
            )}
          </Field>
        )}

        <Field id="rat-requester" label="Área solicitante" required error={shown('requester')}>
          {(a) => (
            <select {...a} value={requester} onChange={(e) => setRequester(e.target.value)} className={`${inputClass(!!shown('requester'))} h-10`}>
              <option value="">Elige el área…</option>
              {AREAS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          )}
        </Field>

        {type !== 'Eliminar' && (type === 'Crear' || activityId) && (
          <fieldset className="flex flex-col gap-4 rounded-card border border-line-soft p-4">
            <legend className="px-1 text-[14.5px] font-bold">{type === 'Crear' ? 'Actividad propuesta' : 'Contenido propuesto (edita lo que cambia)'}</legend>
            <Field id="rat-name" label="Nombre" required error={shown('name')}>
              {(a) => <input {...a} value={draft.name} onChange={(e) => set('name', e.target.value)} className={`${inputClass(!!shown('name'))} h-10`} />}
            </Field>
            <Field id="rat-purpose" label="Finalidad" required error={shown('purpose')}>
              {(a) => <input {...a} value={draft.purpose} onChange={(e) => set('purpose', e.target.value)} className={`${inputClass(!!shown('purpose'))} h-10`} />}
            </Field>
            <Field id="rat-basis" label="Base de licitud" required error={shown('legalBasis')}>
              {(a) => (
                <select {...a} value={draft.legalBasis} onChange={(e) => set('legalBasis', e.target.value)} className={`${inputClass(!!shown('legalBasis'))} h-10`}>
                  <option value="">Elige la base…</option>
                  {LEGAL_BASES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              )}
            </Field>
            <Field id="rat-cats" label="Categorías de datos" required error={shown('dataCategories')}>
              {(a) => <input {...a} value={draft.dataCategories} onChange={(e) => set('dataCategories', e.target.value)} className={`${inputClass(!!shown('dataCategories'))} h-10`} />}
            </Field>
            <Field id="rat-holders" label="Titulares" required error={shown('holders')}>
              {(a) => <input {...a} value={draft.holders} onChange={(e) => set('holders', e.target.value)} className={`${inputClass(!!shown('holders'))} h-10`} />}
            </Field>
            <label className="flex items-center gap-2 text-dense font-semibold">
              <input type="checkbox" checked={draft.international} onChange={(e) => set('international', e.target.checked)} /> Incluye transferencia internacional
            </label>
            {shown('proposal') && <p role="alert" className="text-[14px] font-semibold text-crit-ink">{errors.proposal}</p>}
          </fieldset>
        )}

        <Field id="rat-desc" label={type === 'Eliminar' ? 'Motivo de la eliminación' : 'Descripción de la solicitud'} required error={shown('description')}>
          {(a) => <textarea {...a} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass(!!shown('description'))} p-3`} />}
        </Field>

        {warnings.map((w) => (
          <p key={w.kind} className="flex items-start gap-2 rounded-ctl bg-warn-soft px-3 py-2 text-[15px] text-warn-ink"><IconInfo size={15} className="mt-0.5 flex-none" /> {w.text}</p>
        ))}
      </div>
    </Modal>
  )
}
