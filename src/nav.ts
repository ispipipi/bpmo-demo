export type NavItem = {
  to: string
  label: string
  /** Procesos del catálogo que cubre el módulo (MD §3.2). */
  processes: readonly string[]
  analistaOnly?: boolean
}

export type NavGroup = { title: string; items: readonly NavItem[] }

export const NAV_TOP: readonly NavItem[] = [
  { to: '/', label: 'Dashboard', processes: [] },
  { to: '/mapa', label: 'Mapa de procesos', processes: [] },
  { to: '/alertas', label: 'Alertas y SLA', processes: [], analistaOnly: true },
]

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    title: 'Atención a titulares y a la autoridad',
    items: [
      { to: '/arcop', label: 'Solicitudes ARCOP', processes: ['P1'] },
      { to: '/mpi', label: 'Certificación MPI y autodenuncia', processes: ['P20', 'P19'] },
    ],
  },
  { title: 'Gestión de riesgo y proyectos', items: [{ to: '/riesgo', label: 'Matriz de riesgo', processes: ['P11'] }] },
  {
    title: 'Registro y documentación',
    items: [
      { to: '/rat', label: 'Registro de actividades, RAT', processes: ['P6b'] },
      { to: '/consentimientos', label: 'Consentimientos', processes: ['P8'] },
    ],
  },
  {
    title: 'Terceros',
    items: [{ to: '/proveedores', label: 'Proveedores y transferencias internacionales', processes: ['P10', 'P17'] }],
  },
  { title: 'Gobernanza interna', items: [{ to: '/comites', label: 'Comités de gobernanza', processes: ['P9'] }] },
  { title: 'Reporte y mejora continua', items: [{ to: '/reporteria/1', label: 'Reportería', processes: ['P4'] }] },
]

/** Texto de la miga de cada módulo: [categoría, módulo]. */
export const CRUMBS: Record<string, readonly [string | null, string]> = {
  '': [null, 'Dashboard'],
  mapa: [null, 'Mapa de procesos'],
  alertas: [null, 'Alertas y SLA'],
  arcop: ['Atención a titulares', 'Solicitudes ARCOP'],
  mpi: ['Atención a titulares', 'Certificación MPI y autodenuncia'],
  riesgo: ['Gestión de riesgo', 'Matriz de riesgo'],
  rat: ['Registro y documentación', 'RAT'],
  consentimientos: ['Registro y documentación', 'Consentimientos'],
  proveedores: ['Terceros', 'Proveedores y transferencias'],
  comites: ['Gobernanza interna', 'Comités de gobernanza'],
  reporteria: ['Reporte y mejora continua', 'Reportería'],
  'sin-permisos': [null, 'Sin permisos'],
}
