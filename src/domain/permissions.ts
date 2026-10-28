import type { Role } from './role'

/** Rutas que Legal no puede abrir (MD §2.2: Alertas y SLA y Parámetros). */
const ANALISTA_ONLY: readonly string[] = ['/alertas']

export function canAccess(role: Role, pathname: string): boolean {
  if (role === 'analista') return true
  return !ANALISTA_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export const canWrite = (role: Role): boolean => role === 'analista'
