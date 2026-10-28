import { useEffect, useRef, useState } from 'react'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Cuenta de 600 ms hacia el nuevo valor cuando una cifra cambia (cambio de reloj, MD README). */
export function AnimatedNumber({ value, format = (n: number) => String(n) }: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)

  useEffect(() => {
    if (from.current === value) return
    if (reduced()) {
      from.current = value
      setShown(value)
      return
    }
    const start = performance.now()
    const origin = from.current
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 600)
      const eased = 1 - Math.pow(1 - t, 3)
      setShown(Math.round(origin + (value - origin) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return <span>{format(shown)}</span>
}
