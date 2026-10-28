import { withLog } from './log'
import { err, ok, type Result } from './result'
import type { Consent, ConsentMovement, DemoState } from './types'

const ACTOR = 'Analista PMO'

export type ConsentOp =
  | { kind: 'revoke'; id: string; quantity: number; reason: string }
  | { kind: 'validate'; id: string }
  | { kind: 'campaign'; id: string; size: number }

export type RevocationErrors = Partial<Record<'quantity' | 'reason', string>>

/** Cantidad entera ≥ 1 y ≤ vigentes; motivo obligatorio (MD §6.6). */
export function validateRevocation(c: Consent, quantity: string, reason: string): RevocationErrors {
  const e: RevocationErrors = {}
  const n = Number(quantity)
  if (quantity.trim() === '' || !Number.isInteger(n) || n < 1) e.quantity = 'Ingresa una cantidad entera de 1 o más.'
  else if (n > c.active) e.quantity = `La cantidad no puede superar los ${c.active} titulares vigentes.`
  if (reason.trim() === '') e.reason = 'Indica el motivo.'
  return e
}

/** Resultado simulado: contactos de la lista con consentimiento vigente frente a los que no (AC-11). */
export function simulateCampaign(c: Consent, size: number): { enabled: number; without: number } {
  const enabled = Math.min(Math.max(size, 0), c.active)
  return { enabled, without: Math.max(size, 0) - enabled }
}

export const validateListSize = (v: string): string | null => {
  const n = Number(v)
  return v.trim() !== '' && Number.isInteger(n) && n >= 1 ? null : 'Ingresa el tamaño de la lista (entero de 1 o más).'
}

function edit(s: DemoState, id: string, change: (c: Consent) => Consent | string, log: string): Result<DemoState, string> {
  const c = s.data.consents.find((x) => x.id === id)
  if (!c) return err(`No existe la finalidad ${id}.`)
  const next = change(c)
  if (typeof next === 'string') return err(next)
  return ok(withLog({ ...s, data: { ...s.data, consents: s.data.consents.map((x) => (x.id === id ? next : x)) } }, log, id))
}

export function applyConsentOp(s: DemoState, op: ConsentOp): Result<DemoState, string> {
  switch (op.kind) {
    case 'revoke':
      return edit(
        s,
        op.id,
        (c) => {
          const bad = Object.values(validateRevocation(c, String(op.quantity), op.reason))[0]
          if (bad) return bad
          const movement: ConsentMovement = { id: `${c.id}-M${c.movements.length + 1}`, kind: 'Revocación', holder: 'Lote', date: s.clock, quantity: op.quantity, note: `${op.quantity} ${op.quantity === 1 ? 'revocación' : 'revocaciones'}, lote` }
          return {
            ...c,
            active: c.active - op.quantity,
            revoked: c.revoked + op.quantity,
            movements: [...c.movements, movement],
            history: [...c.history, { date: s.clock, actor: ACTOR, text: `Baja registrada: ${movement.note}. Motivo: ${op.reason.trim()}` }],
          }
        },
        `Registró baja de ${op.quantity} titulares`,
      )
    case 'validate':
      return edit(s, op.id, (c) => ({ ...c, lastValidatedAt: s.clock, history: [...c.history, { date: s.clock, actor: ACTOR, text: 'Validación realizada' }] }), 'Marcó la validación realizada')
    case 'campaign':
      return edit(
        s,
        op.id,
        (c) => {
          const bad = validateListSize(String(op.size))
          if (bad) return bad
          const r = simulateCampaign(c, op.size)
          return { ...c, history: [...c.history, { date: s.clock, actor: ACTOR, text: `Validación de campaña (simulada): lista de ${op.size}, ${r.enabled} habilitados, ${r.without} sin consentimiento` }] }
        },
        'Validó una campaña (simulado)',
      )
  }
}
