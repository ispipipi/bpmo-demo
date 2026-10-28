import { daysLeft } from './sla'
import type { Alert, AlertSeverity, DemoState } from '../types'
import { formatDate } from '../../lib/dates'
import {
  arcopDue,
  consentExpiry,
  isArcopOpen,
  isRatRequestOpen,
  ratRequestDue,
  ratReviewDue,
  vendorDue,
} from './sla'
import { committeeNoticeActive, nextSession } from './tones'

/** Alertas por regla: se recalculan siempre desde los registros (MD §6.2). Ids estables por regla y nivel. */
export function ruleAlerts(s: DemoState): Alert[] {
  const out: Alert[] = []
  const { data, params, clock } = s
  const push = (rule: string, entityId: string | null, severity: AlertSeverity, message: string, module: Alert['module'], to: string) => {
    const id = `regla:${rule}:${entityId ?? '-'}`
    out.push({ id, source: 'regla', severity, message, module, to, entityId, date: clock, status: data.attendedRuleIds.includes(id) ? 'Atendida' : 'Nueva' })
  }

  for (const r of data.arcop.filter(isArcopOpen)) {
    const left = daysLeft(arcopDue(r, params), clock)
    if (left < 0) push('arcop-vencida', r.id, 'Crítica', `${r.id} vencida hace ${-left} d`, 'ARCOP', `/arcop/${r.id}`)
    else if (left <= params.dueSoonDays) push('arcop-por-vencer', r.id, 'Alta', `${r.id} vence en ${left} d`, 'ARCOP', `/arcop/${r.id}`)
  }

  for (const r of data.rat.requests.filter(isRatRequestOpen)) {
    const left = daysLeft(ratRequestDue(r, params), clock)
    const to = `/rat/solicitud/${r.id}`
    if (left < 0) push('rat-fuera-de-plazo', r.id, 'Alta', `Solicitud ${r.id} fuera del plazo interno desde hace ${-left} d`, 'RAT', to)
    else if (left <= params.dueSoonDays) push('rat-por-vencer', r.id, 'Media', `Solicitud ${r.id} vence en ${left} d`, 'RAT', to)
  }

  const reviewLeft = daysLeft(ratReviewDue(data.rat, params), clock)
  if (reviewLeft < 0) push('rat-revision-vencida', null, 'Alta', `Revisión mensual del RAT vencida hace ${-reviewLeft} d`, 'RAT', '/rat')
  else if (reviewLeft <= params.dueSoonDays) push('rat-revision-por-vencer', null, 'Media', `Revisión mensual del RAT vence en ${reviewLeft} d`, 'RAT', '/rat')

  for (const v of data.vendors) {
    const to = `/proveedores?id=${v.id}`
    const noGuarantee = v.international && v.guarantee === null
    if (v.dpa !== 'Vigente') push('proveedor-sin-dpa', v.id, 'Alta', `${v.name} no tiene DPA vigente${noGuarantee ? ' ni mecanismo de garantía' : ''}`, 'Proveedores', to)
    else if (noGuarantee) push('proveedor-sin-garantia', v.id, 'Alta', `${v.name}: transferencia internacional sin mecanismo de garantía`, 'Proveedores', to)
    const due = vendorDue(v)
    if (due !== null) {
      const left = daysLeft(due, clock)
      if (left < 0) push('proveedor-vencido', v.id, 'Alta', `Contrato o DPA de ${v.name} vencido hace ${-left} d`, 'Proveedores', to)
      else if (left <= params.vendorNoticeDays) push('proveedor-por-vencer', v.id, 'Media', `Contrato o DPA de ${v.name} vence en ${left} d`, 'Proveedores', to)
    }
  }

  for (const c of data.consents) {
    if (daysLeft(consentExpiry(c, params), clock) <= params.dueSoonDays) {
      push('consentimiento-por-validar', c.id, 'Media', `Consentimiento "${c.purpose}" por validar`, 'Consentimientos', `/consentimientos?id=${c.id}`)
    }
  }

  for (const a of data.committee.agreements.filter((x) => x.status === 'Pendiente' && x.dueAt < clock)) {
    push('acuerdo-vencido', a.id, 'Alta', `Acuerdo ${a.id} vencido: ${a.description}`, 'Comités', '/comites')
  }
  const next = nextSession(s)
  if (next && committeeNoticeActive(s)) {
    push('comite-proximo', next.id, 'Informativa', `Próximo comité el ${formatDate(next.date)}, en ${daysLeft(next.date, clock)} d`, 'Comités', '/comites')
  }

  for (const f of data.findings.filter((x) => x.stage !== 'Cerrado' && x.severity === 'Alta')) {
    push('autodenuncia-gravedad-alta', f.id, 'Alta', `${f.id}: hallazgo de gravedad Alta abierto`, 'MPI y autodenuncia', `/mpi/hallazgo/${f.id}`)
  }

  return out
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = { Crítica: 0, Alta: 1, Media: 2, Informativa: 3 }

export function allAlerts(s: DemoState): Alert[] {
  const events: Alert[] = s.data.eventAlerts.map((a) => ({ ...a, source: 'evento' }))
  return [...ruleAlerts(s), ...events].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
  )
}

export const newAlerts = (s: DemoState): Alert[] => allAlerts(s).filter((a) => a.status === 'Nueva')
