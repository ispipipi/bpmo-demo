import { describe, expect, it } from 'vitest'
import { STORAGE_KEY } from '../config'
import { createInitialState } from '../domain/seed'
import { applyNextEvent } from '../domain/events'
import type { DemoState } from '../domain/types'
import { clearState, loadState, parsePersisted, saveState, type StorageLike } from './persistence'
import { reducer, simulatedTime } from './reducer'

class MemoryStorage implements StorageLike {
  data = new Map<string, string>()
  getItem = (k: string) => this.data.get(k) ?? null
  setItem = (k: string, v: string) => void this.data.set(k, v)
  removeItem = (k: string) => void this.data.delete(k)
}

const throwing: StorageLike = {
  getItem: () => {
    throw new Error('bloqueado')
  },
  setItem: () => {
    throw new Error('lleno')
  },
  removeItem: () => {
    throw new Error('bloqueado')
  },
}

describe('reducer', () => {
  it('cambiar de rol conserva los datos y deja una línea en la bitácora', () => {
    const s = createInitialState()
    const next = reducer(s, { type: 'setRole', role: 'legal' })
    expect(next.role).toBe('legal')
    expect(next.data).toBe(s.data)
    expect(next.log).toEqual([{ at: s.clock, role: 'analista', action: 'Cambió de rol a Legal ESVAL', entity: 'Sesión' }])
    expect(reducer(next, { type: 'setRole', role: 'legal' })).toBe(next)
  })

  it('Sincronizar aplica E1…E8 en orden y luego queda sin novedades (AC-03)', () => {
    let s = createInitialState()
    for (let i = 1; i <= 8; i++) {
      s = reducer(s, { type: 'syncApplied' })
      expect(s.nextEvent).toBe(i)
      expect(s.log.at(-1)?.action).toContain(`E${i}`)
    }
    const before = s.data
    s = reducer(s, { type: 'syncApplied' })
    expect(s.nextEvent).toBe(8)
    expect(s.data).toBe(before)
    expect(s.log.at(-1)?.action).toContain('sin novedades')
  })

  it('el reducer produce el mismo estado de datos que el dominio', () => {
    const s = createInitialState()
    expect(reducer(s, { type: 'syncApplied' }).data).toEqual(applyNextEvent(s).state.data)
  })

  it('falla simulada: no consume el evento y Reintentar aplica el normal (AC-16)', () => {
    let s = createInitialState()
    s = reducer(s, { type: 'armFailure', on: true })
    expect(s.failNextSync).toBe(true)
    s = reducer(s, { type: 'syncFailed' })
    expect(s.nextEvent).toBe(0)
    expect(s.failNextSync).toBe(false)
    expect(s.connectionError).toBe(true)
    expect(s.data.arcop).toHaveLength(8)
    s = reducer(s, { type: 'syncApplied' })
    expect(s.nextEvent).toBe(1)
    expect(s.connectionError).toBe(false)
    expect(s.data.arcop).toHaveLength(9)
  })

  it('Reiniciar devuelve exactamente al estado inicial: datos, reloj, eventos, parámetros y rol (AC-15)', () => {
    let s = createInitialState()
    s = reducer(s, { type: 'setRole', role: 'legal' })
    for (let i = 0; i < 7; i++) s = reducer(s, { type: 'syncApplied' })
    s = { ...s, params: { ...s.params, arcopDays: 10 } }
    expect(s.clock).not.toBe(createInitialState().clock)
    expect(reducer(s, { type: 'reset' })).toEqual(createInitialState())
  })

  it('la hora simulada avanza 5 min por evento', () => {
    expect(simulatedTime(0)).toBe('09:40')
    expect(simulatedTime(3)).toBe('09:55')
  })
})

describe('persistencia tolerante (MD §7.3, AC-17)', () => {
  it('guarda y recupera el estado completo, incluido el reloj y los eventos consumidos', () => {
    const storage = new MemoryStorage()
    let s: DemoState = createInitialState()
    for (let i = 0; i < 3; i++) s = reducer(s, { type: 'syncApplied' })
    expect(saveState(storage, s)).toBe('ok')
    expect(storage.data.has(STORAGE_KEY)).toBe(true)
    const loaded = loadState(storage)
    expect(loaded.state).toEqual(s)
    expect(loaded.state.clock).toBe(s.clock)
    expect(loaded.status).toBe('ok')
    expect(loaded.notice).toBeNull()
  })

  it('sin estado guardado arranca desde el seed', () => {
    expect(loadState(new MemoryStorage()).state).toEqual(createInitialState())
  })

  it('con almacenamiento bloqueado funciona en memoria y lo informa', () => {
    expect(loadState(null)).toMatchObject({ status: 'unavailable', state: createInitialState() })
    expect(loadState(throwing).status).toBe('unavailable')
    expect(saveState(null, createInitialState())).toBe('unavailable')
    expect(saveState(throwing, createInitialState())).toBe('write-failed')
    expect(() => clearState(throwing)).not.toThrow()
  })

  it('una estructura de otra versión o dañada se reinicia con aviso', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...createInitialState(), schemaVersion: 2 }))
    expect(loadState(storage)).toMatchObject({ state: createInitialState(), notice: expect.stringContaining('no era compatible') })
    storage.setItem(STORAGE_KEY, '{no es json')
    expect(loadState(storage).notice).not.toBeNull()
    expect(parsePersisted('{no es json')).toEqual({ ok: false, error: 'dañado' })
    expect(parsePersisted(JSON.stringify({ schemaVersion: 1 }))).toEqual({ ok: false, error: 'incompatible' })
  })

  it('rechaza estados con la forma alterada aunque tengan la versión correcta', () => {
    const bad = { ...createInitialState(), data: { ...createInitialState().data, vendors: 'x' } }
    expect(parsePersisted(JSON.stringify(bad)).ok).toBe(false)
    expect(parsePersisted(JSON.stringify({ ...createInitialState(), clock: '12-01-2027' })).ok).toBe(false)
    expect(parsePersisted(JSON.stringify({ ...createInitialState(), role: 'admin' })).ok).toBe(false)
  })

  it('Reiniciar borra el estado guardado', () => {
    const storage = new MemoryStorage()
    saveState(storage, createInitialState())
    clearState(storage)
    expect(storage.data.has(STORAGE_KEY)).toBe(false)
  })
})
