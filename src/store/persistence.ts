import { STORAGE_KEY } from '../config'
import { ROLE_LABEL } from '../domain/role'
import { createInitialState } from '../domain/seed'
import { err, ok, type Result } from '../domain/result'
import type { DemoState } from '../domain/types'

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export type StorageStatus = 'ok' | 'unavailable' | 'write-failed'
export type LoadOutcome = {
  state: DemoState
  status: StorageStatus
  /** Aviso a mostrar una vez al cargar (estructura incompatible o dañada). */
  notice: string | null
}

/** Acceder a localStorage puede lanzar (almacenamiento bloqueado); se trata como "no disponible". */
export function getBrowserStorage(): StorageLike | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const arr = (x: unknown) => Array.isArray(x)

/** Valida la forma mínima que el resto de la app da por supuesta. Cualquier otra cosa se reinicia. */
export function isDemoState(x: unknown): x is DemoState {
  if (!isObj(x) || x.schemaVersion !== 1) return false
  if (typeof x.clock !== 'string' || !ISO.test(x.clock)) return false
  if (typeof x.role !== 'string' || !(x.role in ROLE_LABEL)) return false
  if (!isObj(x.params) || Object.values(x.params).some((v) => typeof v !== 'number')) return false
  if (typeof x.nextEvent !== 'number' || x.nextEvent < 0 || x.nextEvent > 8) return false
  if (typeof x.failNextSync !== 'boolean' || typeof x.connectionError !== 'boolean') return false
  if (x.lastSync !== null && !(isObj(x.lastSync) && typeof x.lastSync.time === 'string' && typeof x.lastSync.date === 'string')) return false
  if (!arr(x.log) || !isObj(x.data)) return false
  const d = x.data
  const lists = ['arcop', 'consents', 'vendors', 'projects', 'findings', 'eventAlerts', 'attendedRuleIds']
  if (lists.some((k) => !arr(d[k]))) return false
  if (!isObj(d.rat) || !arr(d.rat.activities) || !arr(d.rat.requests) || typeof d.rat.version !== 'number') return false
  if ((d.rat.requests as unknown[]).some((r) => !isObj(r) || !('proposal' in r))) return false
  if ((d.findings as unknown[]).some((f) => !isObj(f) || !('evaluatedAt' in f))) return false
  if (!isObj(d.mpi) || !arr(d.mpi.items)) return false
  if (!isObj(d.committee) || !arr(d.committee.sessions) || !arr(d.committee.agreements)) return false
  return d.lastMinutaAt === null || typeof d.lastMinutaAt === 'string'
}

export function parsePersisted(raw: string): Result<DemoState, 'dañado' | 'incompatible'> {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return err('dañado')
  }
  return isDemoState(value) ? ok(value) : err('incompatible')
}

export function loadState(storage: StorageLike | null): LoadOutcome {
  if (storage === null) return { state: createInitialState(), status: 'unavailable', notice: null }
  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return { state: createInitialState(), status: 'unavailable', notice: null }
  }
  if (raw === null) return { state: createInitialState(), status: 'ok', notice: null }
  const parsed = parsePersisted(raw)
  if (parsed.ok) return { state: parsed.value, status: 'ok', notice: null }
  return {
    state: createInitialState(),
    status: 'ok',
    notice: 'El estado guardado no era compatible con esta versión del demo. Se reinició con los datos iniciales.',
  }
}

export function saveState(storage: StorageLike | null, state: DemoState): StorageStatus {
  if (storage === null) return 'unavailable'
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state))
    return 'ok'
  } catch {
    return 'write-failed'
  }
}

export function clearState(storage: StorageLike | null): void {
  try {
    storage?.removeItem(STORAGE_KEY)
  } catch {
    /* sin almacenamiento: no hay nada que borrar */
  }
}
