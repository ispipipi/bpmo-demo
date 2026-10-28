import { D0 } from '../config'
import { addDays } from '../lib/dates'
import { DEFAULT_PARAMS } from './params'
import { newSubtasks } from './templates'
import {
  APPROVERS,
  type Agreement,
  type Approval,
  type Approver,
  type ArcopRequest,
  type ArcopType,
  type Consent,
  type DemoData,
  type DemoState,
  type Finding,
  type HistoryEntry,
  type MpiItem,
  type Project,
  type RatActivity,
  type RatRequest,
  type ScreeningAnswers,
  type SubtaskState,
  type Vendor,
} from './types'

export const SYNC_BASE_TIME = '09:40'

const d = (n: number) => addDays(D0, n)
const h = (n: number, actor: string, text: string): HistoryEntry => ({ date: d(n), actor, text })
const A1 = 'Analista Demo 1'
const A2 = 'Analista Demo 2'

/* ---------- ARCOP ---------- */
function arcopCase(
  n: number,
  type: ArcopType,
  receivedRel: number,
  opts: {
    status: ArcopRequest['status']
    analyst: string | null
    subtasks: readonly SubtaskState[]
    extensionRel?: number
    resolution?: ArcopRequest['resolution']
    closedRel?: number
    response?: string
    ground?: string
    channel?: string
  },
): ArcopRequest {
  const id = `ARCOP-${String(n).padStart(4, '0')}`
  const subtasks = newSubtasks(id, type).map((s, i) => {
    const state = opts.subtasks[i] ?? 'Pendiente'
    return state === 'Completa'
      ? { ...s, state, date: d(receivedRel + 2 + i), evidenceRef: `evid_${id.toLowerCase()}_${i + 1}.pdf` }
      : { ...s, state }
  })
  const history: HistoryEntry[] = [h(receivedRel, 'Ley de Datos (simulado)', `Solicitud de ${type} recibida`)]
  if (opts.analyst) history.push(h(receivedRel + 1, opts.analyst, `Caso asignado a ${opts.analyst}`))
  if (opts.extensionRel !== undefined) history.push(h(opts.extensionRel, opts.analyst ?? A1, 'Prórroga registrada'))
  if (opts.closedRel !== undefined) history.push(h(opts.closedRel, opts.analyst ?? A1, `Caso cerrado: ${opts.resolution ?? 'Respondida'}`))
  return {
    id,
    type,
    holder: `Titular Demo ${String(n).padStart(2, '0')}`,
    channel: opts.channel ?? 'Formulario web',
    receivedAt: d(receivedRel),
    status: opts.status,
    resolution: opts.resolution ?? null,
    closedAt: opts.closedRel !== undefined ? d(opts.closedRel) : null,
    analyst: opts.analyst,
    subtasks,
    extension:
      opts.extensionRel !== undefined
        ? { reason: 'Complejidad de la solicitud: se requiere ubicar datos en varios sistemas.', date: d(opts.extensionRel), days: DEFAULT_PARAMS.arcopExtensionDays }
        : null,
    response: opts.response ?? '',
    rejectionGround: opts.ground ?? null,
    history,
  }
}

const ALL: SubtaskState[] = ['Completa', 'Completa', 'Completa', 'Completa', 'Completa']

const arcop: ArcopRequest[] = [
  arcopCase(1, 'Acceso', -60, { status: 'Cerrada', analyst: A1, subtasks: ALL, resolution: 'Respondida', closedRel: -35, response: 'Se entrega copia de los datos personales tratados.' }),
  arcopCase(2, 'Rectificación', -45, { status: 'Cerrada', analyst: A2, subtasks: ALL, resolution: 'Respondida', closedRel: -20, response: 'Se rectifican los datos de contacto del titular.' }),
  arcopCase(3, 'Acceso', -10, { status: 'En gestión', analyst: A1, subtasks: ['Completa', 'Completa', 'En curso', 'Pendiente', 'Pendiente'] }),
  arcopCase(4, 'Supresión', -20, { status: 'En gestión', analyst: A2, subtasks: ['Completa', 'Completa', 'Completa', 'En curso', 'Pendiente'], extensionRel: -5 }),
  arcopCase(5, 'Oposición', -20, { status: 'Respuesta lista', analyst: A1, subtasks: ALL, extensionRel: -6, response: 'Se acoge la oposición y se deja de tratar el dato para la finalidad indicada.' }),
  arcopCase(6, 'Portabilidad', -20, { status: 'En gestión', analyst: A2, subtasks: ['Completa', 'En curso', 'Pendiente', 'Pendiente', 'Pendiente'], extensionRel: -4 }),
  arcopCase(7, 'Acceso', 0, { status: 'Nueva', analyst: null, subtasks: [], channel: 'Correo electrónico' }),
  arcopCase(8, 'Supresión', -30, {
    status: 'Cerrada',
    analyst: A1,
    subtasks: ['Completa', 'Pendiente', 'Pendiente', 'Pendiente', 'Pendiente'],
    resolution: 'Improcedente',
    closedRel: -25,
    ground: 'El titular no acreditó su identidad dentro del plazo otorgado para hacerlo.',
  }),
]

/* ---------- RAT ---------- */
const act = (n: number, name: string, area: string, purpose: string, basis: string, cats: string, holders: string, intl: boolean): RatActivity => ({
  id: `ACT-${String(n).padStart(2, '0')}`,
  name,
  area,
  purpose,
  legalBasis: basis,
  dataCategories: cats,
  holders,
  international: intl,
  history: [h(-90, A1, 'Actividad registrada en el RAT')],
})

const activities: RatActivity[] = [
  act(1, 'Gestión de clientes residenciales', 'Atención a clientes', 'Administrar el contrato y la facturación del servicio', 'Ejecución de contrato', 'Identificación, contacto, consumo', 'Clientes', false),
  act(2, 'Cobranza y recaudación', 'Finanzas', 'Gestionar pagos y deudas del servicio', 'Ejecución de contrato', 'Identificación, contacto, historial de pago', 'Clientes', false),
  act(3, 'Envío de newsletter', 'Marketing', 'Informar novedades y ofertas', 'Consentimiento', 'Nombre, correo electrónico', 'Clientes y suscriptores', true),
  act(4, 'Campañas por SMS', 'Marketing', 'Comunicar promociones por mensajería', 'Consentimiento', 'Nombre, teléfono', 'Clientes', false),
  act(5, 'Reclamos y atención de contacto', 'Atención a clientes', 'Resolver reclamos y consultas', 'Interés legítimo', 'Identificación, contacto, contenido del reclamo', 'Clientes', false),
  act(6, 'Reclutamiento y selección', 'Recursos Humanos', 'Evaluar postulantes a cargos', 'Medidas precontractuales', 'Identificación, contacto, currículum', 'Postulantes', false),
  act(7, 'Administración de personal', 'Recursos Humanos', 'Gestionar contratos y remuneraciones', 'Obligación legal', 'Identificación, contacto, datos laborales, bancarios', 'Trabajadores', false),
  act(8, 'Videovigilancia de instalaciones', 'Operaciones', 'Resguardar la seguridad de las instalaciones', 'Interés legítimo', 'Imagen', 'Visitantes y trabajadores', false),
  act(9, 'Gestión de accesos de visitas', 'Operaciones', 'Controlar el ingreso a las instalaciones', 'Interés legítimo', 'Identificación', 'Visitantes', false),
  act(10, 'Analítica del sitio web', 'Tecnología', 'Medir uso del sitio y mejorar la experiencia', 'Consentimiento', 'Identificadores en línea, navegación', 'Usuarios del sitio', true),
  act(11, 'Encuestas de satisfacción', 'Atención a clientes', 'Medir la satisfacción del servicio', 'Consentimiento', 'Identificación, contacto, respuestas', 'Clientes', false),
  act(12, 'Registro de proveedores', 'Compras', 'Mantener el catastro de proveedores', 'Ejecución de contrato', 'Identificación, contacto de representantes', 'Representantes de proveedores', false),
  act(13, 'Telemetría de medidores', 'Operaciones', 'Medir consumo para la facturación y la operación', 'Ejecución de contrato', 'Identificación del servicio, consumo', 'Clientes', true),
  act(14, 'Atención de requerimientos legales', 'Legal', 'Responder requerimientos de autoridades y titulares', 'Obligación legal', 'Identificación, contenido del requerimiento', 'Titulares y terceros', false),
]

const pending = (): Approval => ({ state: 'Pendiente', date: null, ref: null, comment: null })
const approved = (rel: number, ref: string): Approval => ({ state: 'Aprobado', date: d(rel), ref, comment: null })
const approvals = (over: Partial<Record<Approver, Approval>>): Record<Approver, Approval> =>
  Object.fromEntries(APPROVERS.map((a) => [a, over[a] ?? pending()])) as Record<Approver, Approval>

const ratRequests: RatRequest[] = [
  {
    id: 'RAT-S-001',
    type: 'Modificar',
    activityId: 'ACT-05',
    requester: 'Atención a clientes',
    description: 'Agregar el canal de WhatsApp como medio de contacto para reclamos.',
    proposal: { name: 'Reclamos y atención de contacto', area: 'Atención a clientes', purpose: 'Resolver reclamos y consultas', legalBasis: 'Interés legítimo', dataCategories: 'Identificación, contacto, número de WhatsApp, contenido del reclamo', holders: 'Clientes', international: false },
    receivedAt: d(-3),
    status: 'En validación',
    approvals: approvals({
      'Dueño del proceso': approved(-2, 'VB-031'),
      Legal: approved(-2, 'VB-032'),
      'TI/Seguridad': approved(-1, 'VB-033'),
    }),
    history: [h(-3, 'Atención a clientes', 'Solicitud de modificación recibida'), h(-3, A1, 'Validación iniciada')],
  },
  {
    id: 'RAT-S-002',
    type: 'Crear',
    activityId: null,
    requester: 'Recursos Humanos',
    description: 'Registrar la actividad de evaluaciones de desempeño anuales.',
    proposal: { name: 'Evaluaciones de desempeño', area: 'Recursos Humanos', purpose: 'Evaluar el desempeño anual del personal', legalBasis: 'Interés legítimo', dataCategories: 'Identificación, cargo, resultados de evaluación', holders: 'Trabajadores', international: false },
    receivedAt: d(0),
    status: 'Recibida',
    approvals: approvals({}),
    history: [h(0, 'Recursos Humanos', 'Solicitud de creación recibida')],
  },
  {
    id: 'RAT-S-003',
    type: 'Modificar',
    activityId: 'ACT-02',
    requester: 'Finanzas',
    description: 'Actualizar las categorías de datos de la cobranza.',
    proposal: { name: 'Cobranza y recaudación', area: 'Finanzas', purpose: 'Gestionar pagos y deudas del servicio', legalBasis: 'Ejecución de contrato', dataCategories: 'Identificación, contacto, historial de pago', holders: 'Clientes', international: false },
    receivedAt: d(-40),
    status: 'Registrada',
    approvals: approvals(Object.fromEntries(APPROVERS.map((a, i) => [a, approved(-12 - i, `VB-0${10 + i}`)])) as Partial<Record<Approver, Approval>>),
    history: [h(-40, 'Finanzas', 'Solicitud recibida'), h(-5, A1, 'Registrada en el RAT, versión 12 (simulado)')],
  },
]

/* ---------- Consentimientos ---------- */
const consent = (n: number, purpose: string, channel: string, activityId: string | null, active: number, revoked: number, validatedRel: number): Consent => ({
  id: `CON-${String(n).padStart(2, '0')}`,
  purpose,
  channel,
  activityId,
  active,
  revoked,
  lastValidatedAt: d(validatedRel),
  movements: [
    { id: `CON-${String(n).padStart(2, '0')}-M1`, kind: 'Alta', holder: `Titular Demo ${String(n * 7).padStart(2, '0')}`, date: d(-20), quantity: 1, note: 'Alta por formulario' },
    ...(revoked > 0
      ? [{ id: `CON-${String(n).padStart(2, '0')}-M2`, kind: 'Revocación' as const, holder: 'Lote', date: d(-45), quantity: revoked, note: `${revoked} revocaciones, lote` }]
      : []),
  ],
  history: [h(validatedRel, A1, 'Validación realizada')],
})

const consents: Consent[] = [
  consent(1, 'Newsletter', 'Correo electrónico', 'ACT-03', 3940, 212, -20),
  consent(2, 'Campañas por SMS', 'SMS', 'ACT-04', 2810, 96, -85),
  consent(3, 'Encuestas de satisfacción', 'Correo electrónico', 'ACT-11', 1650, 41, -30),
  consent(4, 'Analítica del sitio web', 'Sitio web', 'ACT-10', 1320, 180, -15),
  consent(5, 'Ofertas personalizadas', 'Aplicación móvil', null, 980, 55, -40),
  consent(6, 'Telemetría de medidores', 'Portal de clientes', 'ACT-13', 820, 12, -25),
  consent(7, 'Comunicaciones de sorteos', 'Formulario web', null, 612, 20, -10),
  consent(8, 'Cesión a socios comerciales', 'Formulario web', null, 385, 64, -50),
]

/* ---------- Proveedores ---------- */
const vendor = (n: number, name: string, category: string, area: string, country: string, intl: boolean, contractRel: number, maturity: Vendor['maturity'], guarantee: string | null): Vendor => ({
  id: `PRV-${String(n).padStart(3, '0')}`,
  name,
  category,
  area,
  country,
  international: intl,
  dpa: 'Vigente',
  dpaExpiresAt: d(240 + n * 3),
  contractExpiresAt: d(contractRel),
  maturity,
  maturityAt: maturity === 'Sin evaluar' ? null : d(-60),
  guarantee,
  guaranteeRef: guarantee ? `GAR-${String(n).padStart(3, '0')}.pdf` : null,
  requested: { dpa: false, guarantee: false },
  lastReviewAt: d(-100 + n),
  history: [h(-100 + n, A1, 'Proveedor incorporado al catastro')],
})

const vendors: Vendor[] = [
  vendor(1, 'Proveedor Cloud A', 'Infraestructura en la nube', 'Tecnología', 'Estados Unidos', true, 200, 'Alta', 'Cláusulas contractuales tipo'),
  vendor(2, 'Proveedor Analítica B', 'Analítica web', 'Marketing', 'Irlanda', true, 150, 'Media', 'Cláusulas contractuales tipo'),
  vendor(3, 'Proveedor CRM C', 'Gestión de clientes', 'Atención a clientes', 'Estados Unidos', true, 320, 'Alta', 'Certificación de adecuación'),
  vendor(4, 'Proveedor Soporte D', 'Mesa de ayuda', 'Atención a clientes', 'Colombia', true, 120, 'Media', 'Cláusulas contractuales tipo'),
  vendor(5, 'Proveedor Nómina E', 'Remuneraciones', 'Recursos Humanos', 'Chile', false, 400, 'Alta', null),
  vendor(6, 'Proveedor Correo F', 'Envío de correos', 'Marketing', 'Chile', false, 210, 'Media', null),
  vendor(7, 'Proveedor Seguridad G', 'Seguridad física', 'Operaciones', 'Chile', false, 330, 'Baja', null),
  vendor(8, 'Proveedor Cobranza H', 'Cobranza externa', 'Finanzas', 'Chile', false, 260, 'Media', null),
  vendor(9, 'Proveedor Imprenta I', 'Impresión de boletas', 'Finanzas', 'Chile', false, 20, 'Sin evaluar', null),
  vendor(10, 'Proveedor Reclutamiento J', 'Selección de personal', 'Recursos Humanos', 'Chile', false, 180, 'Baja', null),
]

/* ---------- Matriz de riesgo ---------- */
const proj = (n: number, name: string, lead: string, answers: ScreeningAnswers, evaluated: boolean): Project => ({
  id: `PRY-${String(n).padStart(3, '0')}`,
  name,
  lead,
  answers,
  evaluatedAt: evaluated ? d(-10 - n) : null,
  checklistRef: evaluated && n !== 2 ? `checklist_pry_${n}.pdf` : null,
  checklistSignedAt: evaluated && n !== 2 ? d(-9 - n) : null,
  history: [h(-12 - n, A1, evaluated ? 'Proyecto evaluado' : 'Proyecto registrado sin evaluar')],
})

const projects: Project[] = [
  proj(1, 'Rediseño del portal de pagos', 'Jefatura de Tecnología', [false, false, false, false, false], true),
  proj(2, 'Programa de fidelización', 'Jefatura de Marketing', [true, true, false, false, false], true),
  proj(3, 'Biometría en control de acceso', 'Jefatura de Operaciones', [true, false, false, true, true], true),
  proj(4, 'Chatbot de atención', 'Jefatura de Atención a clientes', [null, null, null, null, null], false),
]

/* ---------- Certificación MPI ---------- */
const mpiItem = (n: number, group: string, description: string, state: MpiItem['state'], owner: string, evidence: string | null, rel: number | null, justification: string | null = null): MpiItem => ({
  id: `MPI-${String(n).padStart(2, '0')}`,
  group,
  description,
  state,
  owner,
  evidenceRef: evidence,
  date: rel === null ? null : d(rel),
  justification,
})

const G1 = 'Estructura y responsables'
const G2 = 'Identificación de riesgos'
const G3 = 'Protocolos y controles'
const G4 = 'Capacitación y difusión'
const G5 = 'Supervisión y mejora'
const mpiItems: MpiItem[] = [
  mpiItem(1, G1, 'Encargado de prevención designado y con recursos asignados', 'Cumple', 'Directorio Sanitaria Valparaíso', 'acta_directorio_designacion.pdf', -58),
  mpiItem(2, G1, 'Funciones y facultades del encargado documentadas', 'Cumple', 'Legal Sanitaria Valparaíso', 'reglamento_encargado_v2.pdf', -58),
  mpiItem(3, G1, 'Política de protección de datos aprobada y publicada', 'Cumple', 'Legal Sanitaria Valparaíso', 'politica_pdp_v3.pdf', -41),
  mpiItem(4, G2, 'Matriz de riesgos de tratamiento actualizada', 'Cumple', 'H2D', 'matriz_riesgos_2026.xlsx', -23),
  mpiItem(5, G2, 'Inventario de actividades de tratamiento (RAT) vigente', 'Cumple', 'H2D', 'rat_v12.xlsx', -5),
  mpiItem(6, G2, 'Evaluación de proveedores que tratan datos', 'En progreso', 'Compras Sanitaria Valparaíso', null, null),
  mpiItem(7, G3, 'Protocolo de atención de solicitudes ARCOP', 'Cumple', 'H2D', 'protocolo_arcop_v1.pdf', -38),
  mpiItem(8, G3, 'Protocolo de gestión de brechas de seguridad', 'En progreso', 'TI Sanitaria Valparaíso', null, null),
  mpiItem(9, G3, 'Controles de acceso a sistemas con datos personales', 'Cumple', 'TI Sanitaria Valparaíso', 'informe_accesos_q4.pdf', -25),
  mpiItem(10, G4, 'Programa de capacitación anual ejecutado', 'En progreso', 'RRHH Sanitaria Valparaíso', null, null),
  mpiItem(11, G5, 'Canal de denuncias con resguardo de identidad', 'Cumple', 'Cumplimiento Sanitaria Valparaíso', 'canal_denuncias_ficha.pdf', -33),
  mpiItem(12, G5, 'Auditoría externa del modelo', 'No aplica', 'Directorio Sanitaria Valparaíso', null, -4, 'Primera certificación: la auditoría se realiza tras 12 meses.'),
]

const findings: Finding[] = [
  {
    id: 'HAL-0001',
    origin: 'Manual',
    originRef: null,
    description: 'Planilla con datos de contacto de clientes almacenada en una carpeta compartida sin restricción de acceso.',
    detectedAt: d(-90),
    stage: 'Cerrado',
    severity: 'Media',
    affectedData: 'Nombre y correo electrónico',
    holdersEstimate: 320,
    cause: 'Permisos de carpeta heredados sin revisión.',
    plan: [{ id: 'HAL-0001-A1', action: 'Restringir el acceso y mover la planilla a un repositorio controlado', owner: 'TI de Sanitaria Valparaíso', dueAt: d(-80), done: true }],
    approval: { by: 'DPD de Sanitaria Valparaíso', date: d(-82), ref: 'APR-001.pdf' },
    evaluatedAt: d(-88),
    packageGeneratedAt: d(-81),
    filing: { by: 'DPD de Sanitaria Valparaíso', date: d(-78), ref: 'presentacion_001.pdf' },
    closedAt: d(-60),
    closeResult: 'Plan de corrección ejecutado; sin observaciones de la Agencia.',
    history: [h(-90, A1, 'Hallazgo detectado'), h(-60, A1, 'Caso cerrado')],
  },
]

/* ---------- Comités ---------- */
const agreement = (n: number, sessionId: string, description: string, owner: string, dueRel: number, doneRel: number | null): Agreement => ({
  id: `ACU-${String(n).padStart(3, '0')}`,
  sessionId,
  description,
  owner,
  dueAt: d(dueRel),
  status: doneRel === null ? 'Pendiente' : 'Cumplido',
  doneAt: doneRel === null ? null : d(doneRel),
  followUps: [],
})

const committee = {
  name: 'Comité de protección de datos',
  periodicity: 'Mensual' as const,
  sessions: [
    { id: 'SES-001', date: d(-60), status: 'Realizada' as const, agenda: ['Estado del RAT', 'Solicitudes ARCOP del período'], convocation: null },
    { id: 'SES-002', date: d(-30), status: 'Realizada' as const, agenda: ['Proveedores con transferencia internacional', 'Capacitación del personal'], convocation: null },
    { id: 'SES-003', date: d(25), status: 'Próxima' as const, agenda: ['Seguimiento de acuerdos', 'Avance de la certificación MPI'], convocation: null },
  ],
  agreements: [
    agreement(1, 'SES-001', 'Actualizar la política de privacidad del sitio web', 'Marketing', -35, -38),
    agreement(2, 'SES-001', 'Revisar los accesos a la carpeta de clientes', 'TI de Sanitaria Valparaíso', -40, -42),
    agreement(3, 'SES-002', 'Enviar el listado de proveedores con acceso a datos', 'Compras', 18, null),
    agreement(4, 'SES-002', 'Definir el plan de capacitación semestral', 'Recursos Humanos', 21, null),
    agreement(5, 'SES-002', 'Evaluar la madurez de los proveedores sin evaluar', 'Compras', 35, null),
    agreement(6, 'SES-002', 'Proponer el calendario de simulacros', 'Operaciones', 45, null),
  ],
}

export function createSeedData(): DemoData {
  return {
    arcop: structuredClone(arcop),
    rat: { version: 12, updatedAt: d(-5), reviewedAt: d(-5), activities: structuredClone(activities), requests: structuredClone(ratRequests) },
    consents: structuredClone(consents),
    vendors: structuredClone(vendors),
    projects: structuredClone(projects),
    mpi: {
      status: 'En preparación',
      requestedAt: null,
      expedienteRef: null,
      constanciaAt: null,
      constanciaRef: null,
      items: structuredClone(mpiItems),
      history: [h(-60, A1, 'Checklist de certificación MPI iniciado')],
    },
    findings: structuredClone(findings),
    committee: structuredClone(committee),
    eventAlerts: [],
    attendedRuleIds: [],
    lastMinutaAt: null,
  }
}

export function createInitialState(): DemoState {
  return {
    schemaVersion: 1,
    clock: D0,
    role: 'analista',
    params: { ...DEFAULT_PARAMS },
    nextEvent: 0,
    failNextSync: false,
    lastSync: { date: D0, time: SYNC_BASE_TIME },
    connectionError: false,
    data: createSeedData(),
    log: [],
  }
}
