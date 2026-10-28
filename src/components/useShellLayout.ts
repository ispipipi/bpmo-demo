import { useCallback, useEffect, useState } from 'react'
import { SIDEBAR_KEY } from '../config'

export type Viewport = 'drawer' | 'compact' | 'wide'

const readViewport = (): Viewport => (window.innerWidth < 900 ? 'drawer' : window.innerWidth < 1200 ? 'compact' : 'wide')

function readPref(): boolean | null {
  try {
    const v = window.localStorage.getItem(SIDEBAR_KEY)
    return v === 'collapsed' ? true : v === 'expanded' ? false : null
  } catch {
    return null
  }
}

export function useShellLayout() {
  const [viewport, setViewport] = useState<Viewport>(readViewport)
  const [pref, setPref] = useState<boolean | null>(readPref)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    const onResize = () => setViewport(readViewport())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (viewport !== 'drawer') setDrawerOpen(false)
  }, [viewport])

  const collapsed = viewport === 'drawer' ? false : (pref ?? viewport === 'compact')

  const toggle = useCallback(() => {
    if (viewport === 'drawer') {
      setDrawerOpen((o) => !o)
      return
    }
    const next = !collapsed
    setPref(next)
    try {
      window.localStorage.setItem(SIDEBAR_KEY, next ? 'collapsed' : 'expanded')
    } catch {
      /* sin almacenamiento: la preferencia vive solo en memoria */
    }
  }, [viewport, collapsed])

  return { viewport, collapsed, drawerOpen, closeDrawer: () => setDrawerOpen(false), toggle }
}
