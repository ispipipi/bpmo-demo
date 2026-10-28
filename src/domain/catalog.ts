export type Responsible = 'H2D' | 'Cliente (supervisión H2D)' | 'Compartido'

export const CATEGORIES = [
  'Atención a titulares y a la autoridad',
  'Gestión de riesgo y proyectos',
  'Registro y documentación',
  'Terceros',
  'Gobernanza interna',
  'Reporte y mejora continua',
  'Cultura',
] as const
export type Category = (typeof CATEGORIES)[number]

export type ProcessId =
  | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6a' | 'P6b' | 'P7' | 'P8' | 'P9' | 'P10' | 'P11'
  | 'P12' | 'P13' | 'P14' | 'P15' | 'P16' | 'P17' | 'P18' | 'P19' | 'P20' | 'P21'

export type ProcessDef = {
  id: ProcessId
  name: string
  category: Category
  trigger: string
  responsible: Responsible
  evidence: string
  /** Ruta del módulo que lo cubre; null si no está incluido en el demo. */
  module: string | null
}

const A = CATEGORIES[0]
const R = CATEGORIES[1]
const D = CATEGORIES[2]
const T = CATEGORIES[3]
const G = CATEGORIES[4]
const M = CATEGORIES[5]
const C = CATEGORIES[6]

/** Catálogo fijo del documento de H2D (MD §6.0). Orden = orden de presentación del Mapa. */
export const CATALOG: readonly ProcessDef[] = [
  { id: 'P1', name: 'Gestión de requerimientos ARCOP', category: A, trigger: 'Cada solicitud recibida', responsible: 'H2D', evidence: 'Bitácora de solicitudes con fecha, plazo y resolución', module: '/arcop' },
  { id: 'P2', name: 'Atención de requerimientos de fiscalización', category: A, trigger: 'Cada requerimiento recibido', responsible: 'Compartido', evidence: 'Expediente de respuesta y respaldo de lo entregado', module: null },
  { id: 'P20', name: 'Gestión de certificación MPI', category: A, trigger: 'Una vez, más renovación cada 3 años', responsible: 'H2D', evidence: 'Expediente de certificación y constancia vigente', module: '/mpi' },
  { id: 'P19', name: 'Autodenuncia ante la Agencia', category: A, trigger: 'Ante detección de infracción propia', responsible: 'Compartido', evidence: 'Acta de evaluación y respaldo de la autodenuncia presentada', module: '/mpi?tab=autodenuncia' },
  { id: 'P11', name: 'Matriz de riesgo de nuevos proyectos', category: R, trigger: 'Cada proyecto o producto nuevo propuesto', responsible: 'Compartido', evidence: 'Checklist de screening firmado', module: '/riesgo' },
  { id: 'P14', name: 'Ejecución y asesoría en EIPD', category: R, trigger: 'Cuando el screening lo activa', responsible: 'H2D', evidence: 'EIPD firmada y fechada, con riesgo residual evaluado', module: null },
  { id: 'P6a', name: 'Gestión de brechas de seguridad', category: R, trigger: 'Ante detección de incidente', responsible: 'Compartido', evidence: 'Bitácora del incidente y constancia de notificación', module: null },
  { id: 'P6b', name: 'Mantenimiento del RAT', category: D, trigger: 'Mensual, más ante cada cambio reportado', responsible: 'H2D', evidence: 'RAT versionado con fecha de última actualización', module: '/rat' },
  { id: 'P7', name: 'Actualización de documentación de procesos', category: D, trigger: 'Semestral o ante cambio normativo', responsible: 'H2D', evidence: 'Documentos versionados con historial de cambios', module: null },
  { id: 'P8', name: 'Gestión de consentimientos', category: D, trigger: 'Continuo', responsible: 'Cliente (supervisión H2D)', evidence: 'Registro de quién consintió, cuándo y para qué finalidad', module: '/consentimientos' },
  { id: 'P16', name: 'Gestión de conservación y eliminación de datos', category: D, trigger: 'Trimestral', responsible: 'Cliente (supervisión H2D)', evidence: 'Constancia de depuración o eliminación por sistema', module: null },
  { id: 'P17', name: 'Gestión de transferencias internacionales', category: D, trigger: 'Ante nuevo proveedor, más revisión anual', responsible: 'H2D', evidence: 'Listado de transferencias con mecanismo de garantía asociado', module: '/proveedores' },
  { id: 'P10', name: 'Gestión de información de proveedores', category: T, trigger: 'Ante nuevo proveedor, más revisión anual', responsible: 'H2D', evidence: 'Catastro actualizado y DPA vigentes', module: '/proveedores' },
  { id: 'P9', name: 'Gestión de comités internos', category: G, trigger: 'Mensual o trimestral', responsible: 'H2D', evidence: 'Actas de comité con acuerdos y responsables', module: '/comites' },
  { id: 'P13', name: 'Canal de denuncia interna', category: G, trigger: 'Continuo', responsible: 'Cliente (supervisión H2D)', evidence: 'Registro de denuncias con trazabilidad y resguardo de identidad', module: null },
  { id: 'P21', name: 'Gestión de conflicto de interés del DPD', category: G, trigger: 'Anual o ante cambio de funciones', responsible: 'H2D', evidence: 'Declaración de no conflicto de interés', module: null },
  { id: 'P15', name: 'Plan anual de trabajo y rendición de cuentas', category: G, trigger: 'Anual', responsible: 'H2D', evidence: 'Plan anual y reporte de resultados, difundido internamente', module: null },
  { id: 'P4', name: 'Gestión de dashboard y reportería', category: M, trigger: 'Mensual', responsible: 'H2D', evidence: 'Panel actualizado y minuta de reporte', module: '/reporteria/1' },
  { id: 'P3', name: 'Agenda y ejecución de simulacros operacionales', category: M, trigger: 'Semestral o anual', responsible: 'H2D', evidence: 'Acta del simulacro y plan de mejora', module: null },
  { id: 'P5', name: 'Documentación de casos legales', category: M, trigger: 'Ante escalamiento de un caso', responsible: 'Compartido', evidence: 'Reporte legal del caso con resolución', module: null },
  { id: 'P18', name: 'Mantenimiento del contacto del DPD', category: M, trigger: 'Continuo', responsible: 'H2D', evidence: 'Constancia de publicación vigente en sitio web', module: null },
  { id: 'P12', name: 'Gestión del cambio', category: C, trigger: 'Semestral, más inducción a nuevo personal', responsible: 'H2D', evidence: 'Registro de asistencia y material entregado', module: null },
]

export const NOT_INCLUDED_TEXT = 'Este proceso forma parte del servicio de H2D, pero no está incluido en este demo'

export const processById = (id: ProcessId): ProcessDef => {
  const p = CATALOG.find((x) => x.id === id)
  if (!p) throw new Error(`Proceso desconocido: ${id}`)
  return p
}

export const isIncluded = (p: ProcessDef): boolean => p.module !== null
