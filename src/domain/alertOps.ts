import { allAlerts } from './derive/alerts'
import { withLog } from './log'
import { err, ok, type Result } from './result'
import type { Alert, DemoState, HistoryEntry } from './types'

const ACTOR = 'Analista PMO'
export type AlertOp = { kind: 'attend'; id: string } | { kind: 'reminder'; id: string }

/** A quién se le recuerda y dónde queda el registro. Null si la alerta no tiene un responsable que recordar. */
export function reminderTarget(s: DemoState, a: Alert): { who: string; entity: string } | null {
  const id = a.entityId
  if (!id) return null
  switch (a.module) {
    case 'ARCOP': {
      const r = s.data.arcop.find((x) => x.id === id)
      if (!r || r.status === 'Cerrada') return null
      const pending = r.subtasks.find((t) => t.external && t.state !== 'Completa')
      return { who: pending?.responsible ?? r.analyst ?? 'el analista asignado', entity: id }
    }
    case 'RAT': {
      const r = s.data.rat.requests.find((x) => x.id === id)
      const who = r && (Object.entries(r.approvals).find(([, v]) => v.state !== 'Aprobado')?.[0] ?? r.requester)
      return r && who ? { who, entity: id } : null
    }
    case 'Proveedores': {
      const v = s.data.vendors.find((x) => x.id === id)
      return v ? { who: v.area, entity: id } : null
    }
    case 'Comités': {
      const g = s.data.committee.agreements.find((x) => x.id === id)
      return g ? { who: g.owner, entity: id } : null
    }
    case 'Consentimientos': {
      const c = s.data.consents.find((x) => x.id === id)
      const area = c?.activityId ? s.data.rat.activities.find((x) => x.id === c.activityId)?.area : undefined
      return c && area ? { who: area, entity: id } : null
    }
    default:
      return null
  }
}

function addHistory(s: DemoState, a: Alert, text: string): DemoState {
  const id = a.entityId
  const h = <T extends { history: HistoryEntry[] }>(x: T): T => ({ ...x, history: [...x.history, { date: s.clock, actor: ACTOR, text }] })
  const d = s.data
  switch (a.module) {
    case 'ARCOP': return { ...s, data: { ...d, arcop: d.arcop.map((x) => (x.id === id ? h(x) : x)) } }
    case 'RAT': return { ...s, data: { ...d, rat: { ...d.rat, requests: d.rat.requests.map((x) => (x.id === id ? h(x) : x)) } } }
    case 'Proveedores': return { ...s, data: { ...d, vendors: d.vendors.map((x) => (x.id === id ? h(x) : x)) } }
    case 'Consentimientos': return { ...s, data: { ...d, consents: d.consents.map((x) => (x.id === id ? h(x) : x)) } }
    case 'Comités': return { ...s, data: { ...d, committee: { ...d.committee, agreements: d.committee.agreements.map((x) => (x.id === id ? { ...x, followUps: [...x.followUps, { date: s.clock, text }] } : x)) } } }
    default: return s
  }
}

export function applyAlertOp(s: DemoState, op: AlertOp): Result<DemoState, string> {
  const alert = allAlerts(s).find((x) => x.id === op.id)
  if (!alert) return err('La alerta ya no existe: la condición que la originó dejó de cumplirse.')
  if (alert.status === 'Atendida') return err('La alerta ya está atendida.')

  if (op.kind === 'attend') {
    const next: DemoState =
      alert.source === 'regla'
        ? { ...s, data: { ...s.data, attendedRuleIds: [...s.data.attendedRuleIds, alert.id] } }
        : { ...s, data: { ...s.data, eventAlerts: s.data.eventAlerts.map((e) => (e.id === alert.id ? { ...e, status: 'Atendida' as const } : e)) } }
    return ok(withLog(next, `Marcó atendida la alerta: ${alert.message}`, alert.entityId ?? alert.module))
  }

  const target = reminderTarget(s, alert)
  if (!target) return err('Esta alerta no tiene un responsable al que enviar un recordatorio.')
  const text = `Recordatorio simulado enviado a ${target.who}`
  return ok(withLog(addHistory(s, alert, text), `${text} por la alerta: ${alert.message}`, target.entity))
}
