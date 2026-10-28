import type { Role } from './role'

export type ISODate = string
export type HistoryEntry = { date: ISODate; actor: string; text: string }

/* ---------- ARCOP (P1) ---------- */
export const ARCOP_TYPES = ['Acceso', 'Rectificación', 'Supresión', 'Oposición', 'Portabilidad'] as const
export type ArcopType = (typeof ARCOP_TYPES)[number]
export type ArcopStatus = 'Nueva' | 'En gestión' | 'Respuesta lista' | 'Cerrada'
export type SubtaskState = 'Pendiente' | 'En curso' | 'Completa'
export type Subtask = {
  id: string
  name: string
  responsible: string
  external: boolean
  state: SubtaskState
  date: ISODate | null
  evidenceRef: string | null
}
export type ArcopRequest = {
  id: string
  type: ArcopType
  holder: string
  channel: string
  receivedAt: ISODate
  status: ArcopStatus
  resolution: 'Respondida' | 'Improcedente' | null
  closedAt: ISODate | null
  analyst: string | null
  subtasks: Subtask[]
  extension: { reason: string; date: ISODate; days: number } | null
  response: string
  rejectionGround: string | null
  history: HistoryEntry[]
}

/* ---------- RAT (P6b) ---------- */
export const APPROVERS = ['Dueño del proceso', 'Legal', 'TI/Seguridad', 'DPD', 'Compliance'] as const
export type Approver = (typeof APPROVERS)[number]
export type ApprovalState = 'Pendiente' | 'Aprobado' | 'Observado'
export type Approval = { state: ApprovalState; date: ISODate | null; ref: string | null; comment: string | null }
export type ActivityDraft = {
  name: string
  area: string
  purpose: string
  legalBasis: string
  dataCategories: string
  holders: string
  international: boolean
}
/** El estado "En revisión" de una actividad se deriva de sus solicitudes abiertas; no se guarda. */
export type RatActivity = ActivityDraft & { id: string; history: HistoryEntry[] }
export type RatRequestType = 'Crear' | 'Modificar' | 'Eliminar'
export type RatRequestStatus = 'Recibida' | 'En validación' | 'Aprobada' | 'Observada' | 'Rechazada' | 'Registrada'
export type RatRequest = {
  id: string
  type: RatRequestType
  activityId: string | null
  requester: string
  description: string
  /** Contenido propuesto de la actividad (Crear y Modificar); null en Eliminar. */
  proposal: ActivityDraft | null
  receivedAt: ISODate
  status: RatRequestStatus
  approvals: Record<Approver, Approval>
  history: HistoryEntry[]
}
export type Rat = {
  version: number
  updatedAt: ISODate
  reviewedAt: ISODate
  activities: RatActivity[]
  requests: RatRequest[]
}

/* ---------- Consentimientos (P8) ---------- */
export type ConsentMovement = {
  id: string
  kind: 'Alta' | 'Revocación'
  holder: string
  date: ISODate
  quantity: number
  note: string
}
export type Consent = {
  id: string
  purpose: string
  channel: string
  activityId: string | null
  active: number
  revoked: number
  lastValidatedAt: ISODate
  movements: ConsentMovement[]
  history: HistoryEntry[]
}

/* ---------- Proveedores (P10, P17) ---------- */
export type Maturity = 'Alta' | 'Media' | 'Baja' | 'Sin evaluar'
export type Vendor = {
  id: string
  name: string
  category: string
  area: string
  country: string
  international: boolean
  dpa: 'Vigente' | 'Sin DPA'
  dpaExpiresAt: ISODate | null
  contractExpiresAt: ISODate | null
  maturity: Maturity
  maturityAt: ISODate | null
  guarantee: string | null
  guaranteeRef: string | null
  requested: { dpa: boolean; guarantee: boolean }
  lastReviewAt: ISODate | null
  history: HistoryEntry[]
}

/* ---------- Matriz de riesgo (P11) ---------- */
export type Answer = boolean | null
export type ScreeningAnswers = readonly [Answer, Answer, Answer, Answer, Answer]
export type Project = {
  id: string
  name: string
  lead: string
  answers: ScreeningAnswers
  evaluatedAt: ISODate | null
  checklistRef: string | null
  checklistSignedAt: ISODate | null
  history: HistoryEntry[]
}

/* ---------- Certificación MPI (P20) y autodenuncia (P19) ---------- */
export type MpiStatus = 'En preparación' | 'Solicitada' | 'Vigente'
export type MpiItemState = 'Cumple' | 'En progreso' | 'No cumple' | 'No aplica'
export type MpiItem = {
  id: string
  group: string
  description: string
  state: MpiItemState
  owner: string
  evidenceRef: string | null
  date: ISODate | null
  justification: string | null
}
export type Mpi = {
  status: MpiStatus
  requestedAt: ISODate | null
  expedienteRef: string | null
  constanciaAt: ISODate | null
  constanciaRef: string | null
  items: MpiItem[]
  history: HistoryEntry[]
}

export const FINDING_STAGES = [
  'Detectado',
  'En evaluación',
  'Plan de corrección',
  'Aprobación interna',
  'Paquete listo',
  'Presentada',
  'En seguimiento',
  'Cerrado',
] as const
export type FindingStage = (typeof FINDING_STAGES)[number]
export type FindingSeverity = 'Baja' | 'Media' | 'Alta'
export type PlanAction = { id: string; action: string; owner: string; dueAt: ISODate; done: boolean }
export type Finding = {
  id: string
  origin: 'Evento E8' | 'Ítem MPI' | 'Manual'
  originRef: string | null
  description: string
  detectedAt: ISODate
  stage: FindingStage
  severity: FindingSeverity | null
  affectedData: string | null
  holdersEstimate: number | null
  cause: string | null
  plan: PlanAction[]
  approval: { by: string; date: ISODate; ref: string } | null
  /** Fecha del acta de evaluación; null mientras no se completa la evaluación. */
  evaluatedAt: ISODate | null
  packageGeneratedAt: ISODate | null
  filing: { by: string; date: ISODate; ref: string } | null
  closedAt: ISODate | null
  closeResult: string | null
  history: HistoryEntry[]
}

/* ---------- Comités (P9) ---------- */
export type Session = {
  id: string
  date: ISODate
  status: 'Realizada' | 'Próxima'
  agenda: string[]
  convocation: { date: ISODate; time: string; place: string; attendees: string } | null
}
export type Agreement = {
  id: string
  sessionId: string
  description: string
  owner: string
  dueAt: ISODate
  status: 'Pendiente' | 'Cumplido'
  doneAt: ISODate | null
  followUps: { date: ISODate; text: string }[]
}
export type Committee = {
  name: string
  periodicity: 'Mensual' | 'Trimestral'
  sessions: Session[]
  agreements: Agreement[]
}

/* ---------- Alertas ---------- */
export type AlertSeverity = 'Crítica' | 'Alta' | 'Media' | 'Informativa'
export type AlertModule = 'ARCOP' | 'RAT' | 'Consentimientos' | 'Proveedores' | 'MPI y autodenuncia' | 'Comités'
export type Alert = {
  id: string
  source: 'regla' | 'evento'
  severity: AlertSeverity
  message: string
  module: AlertModule
  /** Ruta HashRouter del caso vinculado. */
  to: string
  entityId: string | null
  date: ISODate
  status: 'Nueva' | 'Atendida'
}
export type EventAlert = Omit<Alert, 'source'>

/* ---------- Parámetros (MD §5.4) ---------- */
export type Params = {
  arcopDays: number
  arcopExtensionDays: number
  dueSoonDays: number
  ratValidationDays: number
  ratReviewDays: number
  vendorNoticeDays: number
  committeeNoticeDays: number
  consentValidityDays: number
}

/* ---------- Estado de la aplicación ---------- */
export type LogEntry = { at: ISODate; role: Role; action: string; entity: string }

export type DemoData = {
  arcop: ArcopRequest[]
  rat: Rat
  consents: Consent[]
  vendors: Vendor[]
  projects: Project[]
  mpi: Mpi
  findings: Finding[]
  committee: Committee
  eventAlerts: EventAlert[]
  /** Alertas por regla marcadas como atendidas (id estable por regla y entidad). */
  attendedRuleIds: string[]
  lastMinutaAt: ISODate | null
}

export type DemoState = {
  schemaVersion: 1
  clock: ISODate
  role: Role
  params: Params
  nextEvent: number
  failNextSync: boolean
  /** Última sincronización exitosa (hora simulada). */
  lastSync: { date: ISODate; time: string } | null
  connectionError: boolean
  data: DemoData
  log: LogEntry[]
}
