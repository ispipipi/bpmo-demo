import { useCallback, useEffect, useRef, useState } from 'react'
import { applyNextEvent } from '../domain/events'
import { useStore } from '../store/StoreProvider'
import { useToast } from './feedback'

export const SYNC_STEPS = ['Conectando…', 'Descargando novedades…', 'Validando registros…'] as const
const STEP_MS = 700

/** Sincronización simulada en 3 pasos (1,5–2,5 s). Un solo evento a la vez (MD §5.1). */
export function useSync() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const [step, setStep] = useState<number | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const timers = useRef<number[]>([])
  const runRef = useRef<() => void>(() => undefined)

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  const run = useCallback(() => {
    if (step !== null || timers.current.length > 0) return
    SYNC_STEPS.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => setStep(i), i * STEP_MS))
    })
    setStep(0)
    timers.current.push(
      window.setTimeout(() => {
        timers.current = []
        setStep(null)
        const current = stateRef.current
        if (current.failNextSync) {
          dispatch({ type: 'syncFailed' })
          toast({
            kind: 'error',
            text: 'No se pudo conectar con Ley de Datos (simulado).',
            action: { label: 'Reintentar', run: () => runRef.current() },
          })
          return
        }
        const result = applyNextEvent(current)
        dispatch({ type: 'syncApplied' })
        toast({ kind: 'success', text: result.message })
      }, SYNC_STEPS.length * STEP_MS),
    )
  }, [step, dispatch, toast])
  runRef.current = run

  return { run, running: step !== null, label: step === null ? 'Sincronizar' : SYNC_STEPS[step] }
}
