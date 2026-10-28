import { daysLeft, vendorDue, hasGuarantee, vendorTone } from './derive/sla'
import { nextId } from './ids'
import { withLog } from './log'
import { err, ok, type Result } from './result'
import type { Tone } from './tone'
import type { DemoState, Maturity, Vendor } from './types'

const ACTOR = 'Analista PMO'
export const COUNTRIES = ['Chile', 'Alemania', 'Argentina', 'Brasil', 'Colombia', 'España', 'Estados Unidos', 'Irlanda'] as const
export const MATURITIES: readonly Exclude<Maturity, 'Sin evaluar'>[] = ['Alta', 'Media', 'Baja']
export const MIN_GUARANTEE = 5

export type NewVendorInput = { name: string; category: string; area: string; country: string; international: boolean }
export type VendorOp =
  | { kind: 'request'; id: string }
  | { kind: 'dpa'; id: string; expiresAt: string; ref: string }
  | { kind: 'guarantee'; id: string; text: string; ref: string }
  | { kind: 'maturity'; id: string; level: Exclude<Maturity, 'Sin evaluar'> }
  | { kind: 'review'; id: string }
  | { kind: 'contract'; id: string; date: string }
  | { kind: 'add'; input: NewVendorInput }

const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d)

/** Estado documental con etiqueta contextual (MD §6.7). La forma de estado la agrega quien lo muestra. */
export function vendorStatus(v: Vendor, s: DemoState): { tone: Tone; label: string } {
  const tone = vendorTone(v, s)
  const noGuarantee = v.international && !hasGuarantee(v)
  const due = vendorDue(v)
  const left = due ? daysLeft(due, s.clock) : null
  if (tone === 'crit') {
    if (v.dpa !== 'Vigente') return { tone, label: noGuarantee ? 'Sin DPA ni garantía' : 'Sin DPA' }
    if (noGuarantee) return { tone, label: 'Sin garantía' }
    return { tone, label: 'Contrato vencido' }
  }
  if (tone === 'warn') return { tone, label: left !== null && left >= 0 ? `Vence en ${left} d` : 'Por vencer' }
  return { tone, label: 'Vigente' }
}

export type VendorFormErrors = Partial<Record<'name' | 'category' | 'area' | 'country', string>>
export function validateNewVendor(i: NewVendorInput): VendorFormErrors {
  const e: VendorFormErrors = {}
  if (i.name.trim() === '') e.name = 'Indica el nombre del proveedor.'
  if (i.category.trim() === '') e.category = 'Indica la categoría.'
  if (i.area.trim() === '') e.area = 'Elige el área.'
  if (!(COUNTRIES as readonly string[]).includes(i.country)) e.country = 'Elige el país de alojamiento.'
  return e
}
/** País distinto de Chile fuerza transferencia internacional "Sí" (MD §6.7). */
export const forcesInternational = (country: string): boolean => country !== '' && country !== 'Chile'

export const validateDpa = (d: { expiresAt: string; ref: string }): Partial<Record<'expiresAt' | 'ref', string>> => ({
  ...(isDate(d.expiresAt) ? {} : { expiresAt: 'Ingresa la fecha de vencimiento.' }),
  ...(d.ref.trim() === '' ? { ref: 'Indica la referencia.' } : {}),
})
export const validateGuarantee = (g: { text: string; ref: string }): Partial<Record<'text' | 'ref', string>> => ({
  ...(g.text.trim().length >= MIN_GUARANTEE ? {} : { text: `El mecanismo debe tener al menos ${MIN_GUARANTEE} caracteres.` }),
  ...(g.ref.trim() === '' ? { ref: 'Indica la referencia.' } : {}),
})

function edit(s: DemoState, id: string, change: (v: Vendor) => Vendor | string, log: string): Result<DemoState, string> {
  const v = s.data.vendors.find((x) => x.id === id)
  if (!v) return err(`No existe el proveedor ${id}.`)
  const next = change(v)
  if (typeof next === 'string') return err(next)
  return ok(withLog({ ...s, data: { ...s.data, vendors: s.data.vendors.map((x) => (x.id === id ? next : x)) } }, log, id))
}

const note = (s: DemoState, v: Vendor, text: string): Vendor => ({ ...v, history: [...v.history, { date: s.clock, actor: ACTOR, text }] })

export function applyVendorOp(s: DemoState, op: VendorOp): Result<DemoState, string> {
  switch (op.kind) {
    case 'request':
      return edit(
        s,
        op.id,
        (v) => {
          const missingDpa = v.dpa !== 'Vigente'
          const missingGuarantee = v.international && !hasGuarantee(v)
          if (!missingDpa && !missingGuarantee) return 'El proveedor no tiene documentos pendientes de solicitar.'
          const what = [missingDpa && 'DPA', missingGuarantee && 'mecanismo de garantía'].filter(Boolean).join(' y ')
          return note(s, { ...v, requested: { dpa: v.requested.dpa || missingDpa, guarantee: v.requested.guarantee || missingGuarantee } }, `Recordatorio simulado enviado a ${v.area} para obtener ${what}`)
        },
        'Solicitó DPA o garantía (simulado)',
      )
    case 'dpa':
      return edit(
        s,
        op.id,
        (v) => {
          const bad = Object.values(validateDpa(op))[0]
          if (bad) return bad
          return note(s, { ...v, dpa: 'Vigente', dpaExpiresAt: op.expiresAt, requested: { ...v.requested, dpa: false } }, `DPA recibido (${op.ref.trim()}), vigente hasta ${op.expiresAt}`)
        },
        'Marcó el DPA recibido',
      )
    case 'guarantee':
      return edit(
        s,
        op.id,
        (v) => {
          if (!v.international) return 'Este proveedor no tiene transferencia internacional: no exige mecanismo de garantía.'
          const bad = Object.values(validateGuarantee(op))[0]
          if (bad) return bad
          return note(s, { ...v, guarantee: op.text.trim(), guaranteeRef: op.ref.trim(), requested: { ...v.requested, guarantee: false } }, `Mecanismo de garantía definido: ${op.text.trim()} (${op.ref.trim()})`)
        },
        'Definió el mecanismo de garantía',
      )
    case 'maturity':
      return edit(s, op.id, (v) => note(s, { ...v, maturity: op.level, maturityAt: s.clock }, `Madurez evaluada: ${op.level}`), `Evaluó la madurez (${op.level})`)
    case 'review':
      return edit(s, op.id, (v) => note(s, { ...v, lastReviewAt: s.clock }, 'Revisión anual registrada'), 'Registró la revisión anual')
    case 'contract':
      return edit(
        s,
        op.id,
        (v) => (isDate(op.date) ? note(s, { ...v, contractExpiresAt: op.date }, `Vencimiento del contrato actualizado a ${op.date}`) : 'Ingresa la fecha de vencimiento.'),
        'Actualizó el vencimiento del contrato',
      )
    case 'add': {
      const bad = Object.values(validateNewVendor(op.input))[0]
      if (bad) return err(bad)
      const id = nextId('PRV', s.data.vendors.map((v) => v.id), 3)
      const v: Vendor = {
        id,
        name: op.input.name.trim(),
        category: op.input.category.trim(),
        area: op.input.area,
        country: op.input.country,
        international: forcesInternational(op.input.country) || op.input.international,
        dpa: 'Sin DPA',
        dpaExpiresAt: null,
        contractExpiresAt: null,
        maturity: 'Sin evaluar',
        maturityAt: null,
        guarantee: null,
        guaranteeRef: null,
        requested: { dpa: false, guarantee: false },
        lastReviewAt: null,
        history: [{ date: s.clock, actor: ACTOR, text: 'Proveedor agregado al catastro' }],
      }
      return ok(withLog({ ...s, data: { ...s.data, vendors: [...s.data.vendors, v] } }, `Agregó el proveedor ${v.name}`, id))
    }
  }
}
