import { err, ok, type Result } from './result'
import type { Params } from './types'

export const DEFAULT_PARAMS: Params = {
  arcopDays: 30,
  arcopExtensionDays: 30,
  dueSoonDays: 7,
  ratValidationDays: 15,
  ratReviewDays: 30,
  vendorNoticeDays: 30,
  committeeNoticeDays: 7,
  consentValidityDays: 90,
}

export const PARAM_SPECS: Record<keyof Params, { label: string; min: number; max: number }> = {
  arcopDays: { label: 'Plazo de respuesta ARCOP (días corridos)', min: 1, max: 365 },
  arcopExtensionDays: { label: 'Prórroga ARCOP (días)', min: 1, max: 365 },
  dueSoonDays: { label: 'Umbral "por vencer" (días restantes)', min: 1, max: 60 },
  ratValidationDays: { label: 'Plazo interno de validación de solicitud RAT (días)', min: 1, max: 90 },
  ratReviewDays: { label: 'Periodicidad de la revisión del RAT (días)', min: 1, max: 365 },
  vendorNoticeDays: { label: 'Aviso de vencimiento de contrato o DPA de proveedor (días)', min: 1, max: 180 },
  committeeNoticeDays: { label: 'Aviso de próximo comité (días)', min: 1, max: 60 },
  consentValidityDays: { label: 'Vigencia de la validación de un consentimiento (días)', min: 1, max: 365 },
}

export type ParamErrors = Partial<Record<keyof Params, string>>

/** Parsea valores de formulario (texto) a Params. Cualquier error impide guardar (AC-10). */
export function parseParams(raw: Record<keyof Params, string>): Result<Params, ParamErrors> {
  const errors: ParamErrors = {}
  const out = { ...DEFAULT_PARAMS }
  for (const key of Object.keys(PARAM_SPECS) as (keyof Params)[]) {
    const spec = PARAM_SPECS[key]
    const text = raw[key].trim()
    const n = Number(text)
    if (text === '' || !Number.isInteger(n)) {
      errors[key] = 'Ingresa un número entero.'
    } else if (n < spec.min || n > spec.max) {
      errors[key] = `Debe estar entre ${spec.min} y ${spec.max}.`
    } else {
      out[key] = n
    }
  }
  return Object.keys(errors).length > 0 ? err(errors) : ok(out)
}
