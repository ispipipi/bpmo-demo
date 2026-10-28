import { CATALOG, isIncluded } from '../catalog'
import type { DemoState, AlertSeverity } from '../types'
import { newAlerts } from './alerts'
import { mpiCompliancePct, openFindings } from './mpi'
import {
  arcopClosedInTime,
  arcopDue,
  consentStatus,
  daysLeft,
  hasGuarantee,
  isArcopOpen,
  isEvaluated,
  isRatRequestOpen,
  ratRequestDue,
  revocationsInLast,
  screening,
} from './sla'
import { allCategoryTones, nextSession, processTone } from './tones'
import { worstTone, type Tone } from '../tone'

export function dashboardKpis(s: DemoState) {
  const { data, params, clock } = s
  const open = data.arcop.filter(isArcopOpen)
  const closed = data.arcop.filter((r) => r.status === 'Cerrada' && r.resolution === 'Respondida')
  const inTime = closed.filter((r) => arcopClosedInTime(r, params) === true).length
  const lefts = open.map((r) => daysLeft(arcopDue(r, params), clock))
  const alertsBySeverity: Record<AlertSeverity, number> = { Crítica: 0, Alta: 0, Media: 0, Informativa: 0 }
  for (const a of newAlerts(s)) alertsBySeverity[a.severity]++
  const next = nextSession(s)
  return {
    categoryTones: allCategoryTones(s),
    atencion: {
      arcopOpen: open.length,
      arcopDueSoon: lefts.filter((n) => n >= 0 && n <= params.dueSoonDays).length,
      arcopOverdue: lefts.filter((n) => n < 0).length,
      arcopClosedInTimePct: closed.length === 0 ? null : Math.round((inTime / closed.length) * 100),
      mpiStatus: data.mpi.status,
      mpiPct: mpiCompliancePct(data.mpi),
      findingsOpen: openFindings(s).length,
    },
    riesgo: {
      unevaluated: data.projects.filter((p) => !isEvaluated(p)).length,
      requireEipd: data.projects.filter((p) => screening(p.answers)?.requiresEipd === true).length,
    },
    registro: {
      ratVersion: data.rat.version,
      ratUpdatedAt: data.rat.updatedAt,
      ratRequestsInValidation: data.rat.requests.filter((r) => r.status === 'En validación').length,
      ratRequestsOverdue: data.rat.requests.filter((r) => isRatRequestOpen(r) && daysLeft(ratRequestDue(r, params), clock) < 0).length,
      activeHolders: data.consents.reduce((n, c) => n + c.active, 0),
      revocations30: data.consents.reduce((n, c) => n + revocationsInLast(c, clock, 30), 0),
      consentsToValidate: data.consents.filter((c) => consentStatus(c, s) === 'Por validar').length,
      transfersWithoutGuarantee: data.vendors.filter((v) => v.international && !hasGuarantee(v)).length,
    },
    terceros: { withoutValidDpa: data.vendors.filter((v) => v.dpa !== 'Vigente').length },
    gobernanza: {
      nextCommitteeAt: next?.date ?? null,
      nextCommitteeInDays: next ? daysLeft(next.date, clock) : null,
      overdueAgreements: data.committee.agreements.filter((a) => a.status === 'Pendiente' && a.dueAt < clock).length,
    },
    reporte: { lastMinutaAt: data.lastMinutaAt },
    alertsBySeverity,
  }
}


/** Semáforo y contadores del menú lateral. Reportería es informativa: se muestra como anillo gris. */
export function sidebarData(s: DemoState): { tones: Record<string, Tone>; counters: Record<string, number> } {
  const t = (...ids: Parameters<typeof processTone>[0][]): Tone => {
    const tone = worstTone(ids.map((id) => processTone(id, s)))
    return tone === 'info' ? 'na' : tone
  }
  return {
    tones: {
      '/arcop': t('P1'),
      '/mpi': t('P20', 'P19'),
      '/riesgo': t('P11'),
      '/rat': t('P6b'),
      '/consentimientos': t('P8'),
      '/proveedores': t('P10', 'P17'),
      '/comites': t('P9'),
      '/reporteria/1': t('P4'),
    },
    counters: {
      '/alertas': newAlerts(s).length,
      '/arcop': s.data.arcop.filter((r) => r.status === 'Nueva' && r.analyst === null).length,
    },
  }
}

export const includedCount = () => CATALOG.filter(isIncluded).length
