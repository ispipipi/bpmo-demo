import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react'
import type { DemoState } from '../domain/types'
import type { Action } from './actions'
import { clearState, getBrowserStorage, loadState, saveState, type StorageLike, type StorageStatus } from './persistence'
import { reducer } from './reducer'

type StoreValue = {
  state: DemoState
  dispatch: Dispatch<Action>
  storage: StorageStatus
  /** Aviso de carga (estado incompatible); se entrega una sola vez. */
  takeLoadNotice: () => string | null
  retrySave: () => void
}

const Ctx = createContext<StoreValue | null>(null)

export function StoreProvider({ children, storage: injected }: { children: ReactNode; storage?: StorageLike | null }) {
  const store = useRef<StorageLike | null>(injected === undefined ? getBrowserStorage() : injected)
  const [initial] = useState(() => loadState(store.current))
  const notice = useRef<string | null>(initial.notice)

  const [state, rawDispatch] = useReducer(reducer, initial.state)
  const [status, setStatus] = useState<StorageStatus>(initial.status)

  const dispatch = useCallback<Dispatch<Action>>(
    (a) => {
      if (a.type === 'reset') clearState(store.current)
      rawDispatch(a)
    },
    [],
  )

  useEffect(() => {
    setStatus(saveState(store.current, state))
  }, [state])

  const retrySave = useCallback(() => setStatus(saveState(store.current, state)), [state])
  const takeLoadNotice = useCallback(() => {
    const n = notice.current
    notice.current = null
    return n
  }, [])

  const value = useMemo(() => ({ state, dispatch, storage: status, takeLoadNotice, retrySave }), [state, dispatch, status, takeLoadNotice, retrySave])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore fuera de StoreProvider')
  return v
}
