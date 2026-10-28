import { applyArcopOp } from '../domain/arcop'
import { applyAlertOp } from '../domain/alertOps'
import { applyMpiOp } from '../domain/certification'
import { applyCommitteeOp } from '../domain/committee'
import { applyConsentOp } from '../domain/consent'
import { DEFAULT_PARAMS } from '../domain/params'
import { generateMinuta } from '../domain/reports'
import { applyProjectOp } from '../domain/projects'
import { applyVendorOp } from '../domain/vendors'
import { applyFindingOp } from '../domain/finding'
import { applyRatOp } from '../domain/rat'
import { ROLE_LABEL } from '../domain/role'
import { applyNextEvent } from '../domain/events'
import { createInitialState, SYNC_BASE_TIME } from '../domain/seed'
import { withLog } from '../domain/log'
import type { DemoState } from '../domain/types'
import type { Action } from './actions'

/** Hora simulada de la sincronización: base + 5 min por evento consumido. */
export function simulatedTime(eventsApplied: number): string {
  const [h, m] = SYNC_BASE_TIME.split(':').map(Number) as [number, number]
  const total = h * 60 + m + 5 * eventsApplied
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function reducer(state: DemoState, action: Action): DemoState {
  switch (action.type) {
    case 'setRole':
      if (state.role === action.role) return state
      return { ...withLog(state, `Cambió de rol a ${ROLE_LABEL[action.role]}`, 'Sesión'), role: action.role }

    case 'syncApplied': {
      const r = applyNextEvent(state)
      const next: DemoState = {
        ...r.state,
        failNextSync: false,
        connectionError: false,
        lastSync: { date: r.state.clock, time: simulatedTime(r.state.nextEvent) },
      }
      return withLog(next, r.eventId ? `Sincronización con Ley de Datos (simulada): aplicó ${r.eventId}` : 'Sincronización con Ley de Datos (simulada): sin novedades', 'Ley de Datos')
    }

    case 'syncFailed':
      return withLog({ ...state, failNextSync: false, connectionError: true }, 'Sincronización fallida (simulada); el evento no se consumió', 'Ley de Datos')

    case 'armFailure':
      if (state.failNextSync === action.on) return state
      return withLog({ ...state, failNextSync: action.on }, action.on ? 'Activó la simulación de falla de conexión' : 'Desactivó la simulación de falla de conexión', 'Control de demo')

    case 'reset':
      return createInitialState()

    case 'arcop': {
      const r = applyArcopOp(state, action.op)
      return r.ok ? r.value : state
    }

    case 'rat': {
      const r = applyRatOp(state, action.op)
      return r.ok ? r.value : state
    }

    case 'mpi': {
      const r = applyMpiOp(state, action.op)
      return r.ok ? r.value : state
    }

    case 'finding': {
      const r = applyFindingOp(state, action.op)
      return r.ok ? r.value : state
    }

    case 'consent': {
      const r = applyConsentOp(state, action.op)
      return r.ok ? r.value : state
    }

    case 'vendor': {
      const r = applyVendorOp(state, action.op)
      return r.ok ? r.value : state
    }

    case 'project': {
      const r = applyProjectOp(state, action.op)
      return r.ok ? r.value : state
    }

    case 'committee': {
      const r = applyCommitteeOp(state, action.op)
      return r.ok ? r.value : state
    }

    case 'alert': {
      const r = applyAlertOp(state, action.op)
      return r.ok ? r.value : state
    }

    case 'setParams':
      return withLog({ ...state, params: action.params }, 'Actualizó los parámetros; los semáforos y alertas se recalcularon', 'Parámetros')

    case 'minuta':
      return generateMinuta(state)

    case 'resetParams':
      return withLog({ ...state, params: { ...DEFAULT_PARAMS } }, 'Restauró los parámetros por defecto', 'Parámetros')
  }
}
