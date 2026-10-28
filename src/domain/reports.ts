import { CATALOG, CATEGORIES, isIncluded, type Category, type ProcessId } from './catalog'
import { allAlerts } from './derive/alerts'
import { dashboardKpis } from './derive/kpis'
import { mpiCompliancePct } from './derive/mpi'
import { arcopClosedInTime, arcopDue, hasGuarantee, isArcopOpen, vendorDue, daysLeft } from './derive/sla'
import { categoryStatus, processStatus, type CategoryStatus, type ProcessStatus } from './derive/tones'
import { agreementStatus } from './committee'
import { withLog } from './log'
import { addDays, diffDays, formatDate, monthStart, monthTitle } from '../lib/dates'
import { plural, formatNumber } from '../lib/format'
import { vendorStatus } from './vendors'
import { ARCOP_TYPES, type ArcopRequest, type ArcopStatus, type ArcopType, type DemoState, type ISODate } from './types'

export type Period = '30' | 'mes' | 'todo'
export const PERIODS: readonly { value: Period; label: string }[] = [
  { value: '30', label: 'Últimos 30 días' },
  { value: 'mes', label: 'Mes actual' },
  { value: 'todo', label: 'Todo' },
]
export type Range = { from: ISODate | null; to: ISODate }

/** Períodos calculados contra el reloj de demo, no contra la fecha real. */
export function periodRange(period: Period, clock: ISODate): Range {
  if (period === '30') return { from: addDays(clock, -30), to: clock }
  if (period === 'mes') return { from: monthStart(clock), to: clock }
  return { from: null, to: clock }
}
export const inRange = (date: ISODate | null, r: Range): boolean => date !== null && (r.from === null || date >= r.from) && date <= r.to

export type Table = { header: readonly string[]; rows: string[][] }

/* ---------- 1. Estado de cumplimiento por proceso ---------- */
export type R1Row = { id: ProcessId; name: string; status: ProcessStatus; indicator: string; evidence: string }
export type R1Section = { category: Category; status: CategoryStatus; rows: R1Row[] }

function indicator(pid: ProcessId, s: DemoState): string {
  const k = dashboardKpis(s)
  const { data } = s
  switch (pid) {
    case 'P1': return `${k.atencion.arcopOpen} abiertas · ${k.atencion.arcopOverdue} vencidas · ${k.atencion.arcopDueSoon} por vencer`
    case 'P20': return `${mpiCompliancePct(data.mpi) ?? '—'} % de ítems cumplen · ${data.mpi.status}`
    case 'P19': return `${k.atencion.findingsOpen} ${plural(k.atencion.findingsOpen, 'abierta', 'abiertas')}`
    case 'P11': return `${k.riesgo.unevaluated} sin evaluar · ${k.riesgo.requireEipd} requieren EIPD`
    case 'P6b': return `RAT v${data.rat.version} · actualizado ${formatDate(data.rat.updatedAt)} · ${k.registro.ratRequestsInValidation} en validación`
    case 'P8': return `${formatNumber(k.registro.activeHolders)} titulares vigentes · ${k.registro.revocations30} revocaciones (30 d)`
    case 'P17': return `${data.vendors.filter((v) => v.international).length} transferencias · ${k.registro.transfersWithoutGuarantee} sin mecanismo de garantía`
    case 'P10': return `${data.vendors.length} proveedores · ${k.terceros.withoutValidDpa} sin DPA vigente`
    case 'P9': return `${k.gobernanza.overdueAgreements} acuerdos vencidos · próximo comité ${k.gobernanza.nextCommitteeAt ? formatDate(k.gobernanza.nextCommitteeAt) : '—'}`
    case 'P4': return `Última minuta: ${data.lastMinutaAt ? formatDate(data.lastMinutaAt) : '—'}`
    default: return '—'
  }
}

export function report1(s: DemoState): R1Section[] {
  return CATEGORIES.map((category) => ({
    category,
    status: categoryStatus(category, s),
    rows: CATALOG.filter((p) => p.category === category && isIncluded(p)).map((p) => ({ id: p.id, name: p.name, status: processStatus(p.id, s), indicator: indicator(p.id, s), evidence: p.evidence })),
  })).filter((sec) => sec.rows.length > 0)
}
export const report1Table = (secs: R1Section[]): Table => ({
  header: ['N°', 'Proceso', 'Categoría', 'Estado', 'Indicador principal', 'Evidencia requerida'],
  rows: secs.flatMap((sec) => sec.rows.map((r) => [r.id, r.name, sec.category, r.status.label, r.indicator, r.evidence])),
})

/* ---------- 2. Gestión de solicitudes ARCOP ---------- */
const COLUMNS = ['Nueva', 'En gestión', 'Respuesta lista', 'Cerrada', 'Improcedente'] as const
type Column = (typeof COLUMNS)[number]
export type R2 = {
  range: Range
  total: number
  columns: readonly Column[]
  byType: { type: ArcopType; counts: Record<Column, number>; total: number }[]
  closedInTimePct: number | null
  avgCloseDays: number | null
}

const columnOf = (r: ArcopRequest): Column => (r.status === 'Cerrada' ? (r.resolution === 'Improcedente' ? 'Improcedente' : 'Cerrada') : (r.status as Exclude<ArcopStatus, 'Cerrada'>))

export function report2(s: DemoState, period: Period): R2 {
  const range = periodRange(period, s.clock)
  const reqs = s.data.arcop.filter((r) => inRange(r.receivedAt, range))
  const byType = ARCOP_TYPES.map((type) => {
    const counts = Object.fromEntries(COLUMNS.map((c) => [c, 0])) as Record<Column, number>
    const mine = reqs.filter((r) => r.type === type)
    for (const r of mine) counts[columnOf(r)]++
    return { type, counts, total: mine.length }
  })
  const closed = reqs.filter((r) => r.status === 'Cerrada' && r.resolution === 'Respondida' && r.closedAt)
  const inTime = closed.filter((r) => arcopClosedInTime(r, s.params) === true).length
  const days = closed.map((r) => diffDays(r.receivedAt, r.closedAt as string))
  return {
    range,
    total: reqs.length,
    columns: COLUMNS,
    byType,
    closedInTimePct: closed.length === 0 ? null : Math.round((inTime / closed.length) * 100),
    avgCloseDays: days.length === 0 ? null : Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10,
  }
}
export const report2Table = (r: R2): Table => ({
  header: ['Tipo', ...r.columns, 'Total'],
  rows: r.byType.map((t) => [t.type, ...r.columns.map((c) => String(t.counts[c])), String(t.total)]),
})

/* ---------- 3. RAT versionado y evidencias ---------- */
export type R3Activity = { id: string; name: string; area: string; legalBasis: string; lastChange: ISODate; evidence: string[] }
export type R3 = {
  range: Range
  version: number
  updatedAt: ISODate
  reviewedAt: ISODate
  activities: R3Activity[]
  requests: { id: string; type: string; activity: string; status: string; receivedAt: ISODate }[]
}

export function report3(s: DemoState, period: Period): R3 {
  const { rat } = s.data
  const range = periodRange(period, s.clock)
  const evidenceOf = (id: string) =>
    rat.requests.filter((r) => r.activityId === id && r.status === 'Registrada').flatMap((r) => Object.values(r.approvals).map((a) => a.ref).filter((x): x is string => !!x))
  return {
    range,
    version: rat.version,
    updatedAt: rat.updatedAt,
    reviewedAt: rat.reviewedAt,
    activities: rat.activities.map((a) => ({ id: a.id, name: a.name, area: a.area, legalBasis: a.legalBasis, lastChange: a.history.at(-1)?.date ?? rat.updatedAt, evidence: evidenceOf(a.id) })),
    requests: rat.requests.filter((r) => inRange(r.receivedAt, range)).map((r) => ({ id: r.id, type: r.type, activity: r.activityId ?? 'Actividad nueva', status: r.status, receivedAt: r.receivedAt })),
  }
}
export const report3Table = (r: R3): Table => ({
  header: ['ID', 'Actividad', 'Área', 'Base de licitud', 'Última modificación', 'Evidencias vinculadas'],
  rows: r.activities.map((a) => [a.id, a.name, a.area, a.legalBasis, formatDate(a.lastChange), a.evidence.length > 0 ? a.evidence.join('; ') : '—']),
})

/* ---------- 4. Transferencias internacionales y garantías ---------- */
export type R4Row = { id: string; name: string; country: string; dpa: string; dpaExpiresAt: ISODate | null; due: ISODate | null; guarantee: string | null; guaranteeRef: string | null; status: string }
export const report4 = (s: DemoState): R4Row[] =>
  s.data.vendors.filter((v) => v.international).map((v) => ({ id: v.id, name: v.name, country: v.country, dpa: v.dpa, dpaExpiresAt: v.dpaExpiresAt, due: vendorDue(v), guarantee: hasGuarantee(v) ? v.guarantee : null, guaranteeRef: v.guaranteeRef, status: vendorStatus(v, s).label }))
export const report4Table = (rows: R4Row[]): Table => ({
  header: ['Proveedor', 'País', 'DPA', 'Vencimiento DPA', 'Vencimiento contrato o DPA', 'Mecanismo de garantía', 'Referencia', 'Estado'],
  rows: rows.map((r) => [r.name, r.country, r.dpa, r.dpaExpiresAt ? formatDate(r.dpaExpiresAt) : '—', r.due ? formatDate(r.due) : '—', r.guarantee ?? 'Sin definir', r.guaranteeRef ?? '—', r.status]),
})

/* ---------- 5. Minuta de reporte mensual ---------- */
export type Minuta = {
  title: string
  preparedAt: ISODate
  categories: { category: Category; status: CategoryStatus; summary: string }[]
  arcop: { received: number; closed: number; overdue: number }
  criticalAlerts: string[]
  overdueAgreements: { id: string; description: string; owner: string; dueAt: ISODate }[]
  nextSteps: string | null
}

function categorySummary(category: Category, s: DemoState): string {
  const k = dashboardKpis(s)
  const { data } = s
  const parts: (string | false | null)[] = []
  switch (category) {
    case 'Atención a titulares y a la autoridad': {
      const over = data.arcop.filter((r) => isArcopOpen(r) && daysLeft(arcopDue(r, s.params), s.clock) < 0).map((r) => r.id)
      parts.push(over.length === 1 ? `${over[0]} vencida` : over.length > 1 && `${over.length} ARCOP vencidas`, `MPI ${mpiCompliancePct(data.mpi) ?? '—'} % en ${data.mpi.status.toLowerCase()}`, k.atencion.findingsOpen > 0 && `${k.atencion.findingsOpen} ${plural(k.atencion.findingsOpen, 'autodenuncia abierta', 'autodenuncias abiertas')}`)
      break
    }
    case 'Gestión de riesgo y proyectos':
      parts.push(k.riesgo.unevaluated > 0 && `${k.riesgo.unevaluated} ${plural(k.riesgo.unevaluated, 'proyecto sin evaluar', 'proyectos sin evaluar')}`, k.riesgo.requireEipd > 0 && `${k.riesgo.requireEipd} ${plural(k.riesgo.requireEipd, 'requiere EIPD', 'requieren EIPD')}`)
      break
    case 'Registro y documentación':
      parts.push(k.registro.ratRequestsOverdue > 0 && `${k.registro.ratRequestsOverdue} ${plural(k.registro.ratRequestsOverdue, 'solicitud RAT fuera de plazo', 'solicitudes RAT fuera de plazo')}`, k.registro.revocations30 > 0 && `${k.registro.revocations30} revocaciones`, k.registro.transfersWithoutGuarantee > 0 && `${k.registro.transfersWithoutGuarantee} ${plural(k.registro.transfersWithoutGuarantee, 'transferencia sin garantía', 'transferencias sin garantía')}`, k.registro.consentsToValidate > 0 && `${k.registro.consentsToValidate} ${plural(k.registro.consentsToValidate, 'finalidad por validar', 'finalidades por validar')}`)
      break
    case 'Terceros':
      parts.push(k.terceros.withoutValidDpa > 0 && `${k.terceros.withoutValidDpa} ${plural(k.terceros.withoutValidDpa, 'proveedor sin DPA vigente', 'proveedores sin DPA vigente')}`)
      break
    case 'Gobernanza interna':
      parts.push(k.gobernanza.overdueAgreements > 0 && `${k.gobernanza.overdueAgreements} ${plural(k.gobernanza.overdueAgreements, 'acuerdo vencido', 'acuerdos vencidos')}`, k.gobernanza.nextCommitteeAt && `próximo comité ${formatDate(k.gobernanza.nextCommitteeAt)}`)
      break
    case 'Reporte y mejora continua':
      return 'Esta minuta'
    default:
      return '—'
  }
  const text = parts.filter(Boolean).join('; ')
  return text === '' ? 'Sin pendientes' : text
}

/** Minuta del mes actual con los datos vigentes. Las alertas solo se incluyen para el Analista (MD §6.10). */
export function minuta(s: DemoState, opts: { includeAlerts: boolean }): Minuta {
  const month = periodRange('mes', s.clock)
  const arcop = s.data.arcop
  return {
    title: `Sanitor · ${monthTitle(s.clock)}`,
    preparedAt: s.clock,
    categories: CATEGORIES.filter((c) => CATALOG.some((p) => p.category === c && isIncluded(p))).map((category) => ({ category, status: categoryStatus(category, s), summary: categorySummary(category, s) })),
    arcop: {
      received: arcop.filter((r) => inRange(r.receivedAt, month)).length,
      closed: arcop.filter((r) => inRange(r.closedAt, month)).length,
      overdue: arcop.filter((r) => isArcopOpen(r) && daysLeft(arcopDue(r, s.params), s.clock) < 0).length,
    },
    criticalAlerts: opts.includeAlerts ? allAlerts(s).filter((a) => a.severity === 'Crítica' && a.status === 'Nueva').map((a) => a.message) : [],
    overdueAgreements: s.data.committee.agreements.filter((a) => agreementStatus(a, s.clock) === 'Vencido').map((a) => ({ id: a.id, description: a.description, owner: a.owner, dueAt: a.dueAt })),
    nextSteps: null,
  }
}

/** Registra la fecha de la última minuta generada, que lee el Dashboard (AC-25). */
export const generateMinuta = (s: DemoState): DemoState => withLog({ ...s, data: { ...s.data, lastMinutaAt: s.clock } }, `Generó la minuta mensual (${monthTitle(s.clock)})`, 'Reportería')
