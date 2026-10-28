import type { DemoState } from './types'

/** Toda acción que cambia el estado deja una entrada en la bitácora (MD §7.4). */
export function withLog(state: DemoState, action: string, entity: string): DemoState {
  return { ...state, log: [...state.log, { at: state.clock, role: state.role, action, entity }] }
}
