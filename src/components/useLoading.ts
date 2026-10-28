import { useEffect, useState } from 'react'

/** Estado de carga simulado de 300–600 ms al entrar a listas y detalles (MD §7.2). */
export function useLoading(ms = 400): boolean {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), ms)
    return () => window.clearTimeout(t)
  }, [ms])
  return loading
}
