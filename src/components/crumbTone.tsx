import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Tone } from '../domain/tone'

const Ctx = createContext<{ tone: Tone | null; setTone: (t: Tone | null) => void }>({ tone: null, setTone: () => undefined })

/** El último nivel de la miga se tiñe con el semáforo del registro abierto (spec §B.2). */
export function CrumbToneProvider({ children }: { children: ReactNode }) {
  const [tone, setTone] = useState<Tone | null>(null)
  const value = useMemo(() => ({ tone, setTone }), [tone])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useCrumbToneValue = (): Tone | null => useContext(Ctx).tone

export function useCrumbTone(tone: Tone | null) {
  const { setTone } = useContext(Ctx)
  useEffect(() => {
    setTone(tone)
    return () => setTone(null)
  }, [tone, setTone])
}
