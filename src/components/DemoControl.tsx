import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDate } from '../lib/dates'
import { canWrite } from '../domain/permissions'
import { useStore } from '../store/StoreProvider'
import { BTN, Modal, useToast } from './feedback'
import { IconGear, IconInfo } from './Icons'
import { StateShape } from './StatusChip'

function LogDialog({ onClose }: { onClose: () => void }) {
  const { state } = useStore()
  const rows = [...state.log].reverse()
  return (
    <Modal title="Bitácora de la sesión" variant="wide" onClose={onClose}>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-dense">Aún no hay acciones registradas. Cada acción que hagas quedará aquí con su fecha de demo.</p>
      ) : (
        <div className="max-h-[55vh] overflow-auto rounded-ctl border border-line">
          <table className="w-full text-left text-[15px]">
            <thead className="sticky top-0 bg-sunken text-label text-ink-soft">
              <tr>
                <th className="w-[100px] px-3 py-2">Fecha demo</th>
                <th className="w-[120px] px-3 py-2">Rol</th>
                <th className="px-3 py-2">Acción</th>
                <th className="w-[150px] px-3 py-2">Entidad</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={rows.length - i} className="border-t border-line-soft align-top text-ink">
                  <td className="px-3 py-2 font-mono">{formatDate(r.at)}</td>
                  <td className="px-3 py-2">{r.role === 'analista' ? 'Analista PMO' : 'Legal ESVAL'}</td>
                  <td className="px-3 py-2">{r.action}</td>
                  <td className="px-3 py-2 text-ink-soft">{r.entity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

export function DemoControl() {
  const { state, dispatch, storage, retrySave } = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [dialog, setDialog] = useState<'reset' | 'log' | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const analyst = canWrite(state.role)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        btn.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const lastSync = state.lastSync ? `${formatDate(state.lastSync.date)} ${state.lastSync.time} (simulada)` : '—'

  return (
    <div className="relative flex-none">
      <button
        ref={btn}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Control de demo"
        onClick={() => setOpen((o) => !o)}
        className={`${BTN.secondary} px-3 min-[1200px]:px-4`}
      >
        <IconGear size={16} />
        <span className="hidden min-[1200px]:inline">Control de demo</span>
      </button>

      {open && (
        <div ref={panel} role="dialog" aria-label="Control de demo" className="absolute right-0 top-12 z-30 w-[320px] animate-rise rounded-card bg-surface p-4 shadow-float">
          <div className="text-overline text-ink-soft">CONTROLES DE DEMO</div>

          <div className="mt-3 rounded-ctl bg-sunken p-3 text-[14.5px]">
            <div className="flex items-center gap-1.5 font-semibold">
              <StateShape tone={state.connectionError ? 'crit' : 'ok'} size={8} />
              {state.connectionError ? 'Ley de Datos: error de conexión (simulado)' : 'Ley de Datos: Conectado (simulado)'}
            </div>
            <div className="mt-1 text-ink-soft">Última sincronización: {lastSync}</div>
          </div>

          {storage !== 'ok' && (
            <div role="alert" className="mt-3 rounded-ctl bg-surface p-3 text-[14.5px] shadow-[inset_0_0_0_1.5px_var(--crit)]">
              <div className="flex items-start gap-2 font-semibold text-crit-ink">
                <StateShape tone="crit" size={9} />
                <span>{storage === 'unavailable' ? 'El navegador no permite guardar datos.' : 'No se pudo guardar el estado.'}</span>
              </div>
              <p className="mt-1 text-ink-soft">Los cambios no se conservarán al recargar.</p>
              {storage === 'write-failed' && (
                <button type="button" className={`${BTN.ghost} mt-1 text-brand`} onClick={retrySave}>Reintentar</button>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-col gap-2">
            {analyst && (
              <button
                type="button"
                aria-pressed={state.failNextSync}
                className={BTN.secondary}
                onClick={() => {
                  dispatch({ type: 'armFailure', on: !state.failNextSync })
                  toast({ kind: 'success', text: state.failNextSync ? 'Falla de conexión desactivada (simulado).' : 'La próxima sincronización fallará (simulado).' })
                }}
              >
                {state.failNextSync ? 'Quitar la falla de conexión' : 'Simular falla de conexión'}
              </button>
            )}
            <button type="button" className={BTN.secondary} onClick={() => { setOpen(false); setDialog('log') }}>Ver bitácora</button>
            <button type="button" className={BTN.danger} onClick={() => { setOpen(false); setDialog('reset') }}>Reiniciar demo</button>
          </div>
          <p className="mt-3 flex gap-1.5 text-[14px] text-ink-soft">
            <IconInfo size={14} className="mt-px flex-none" />
            Estos controles son del demo y no existirían en la plataforma real.
          </p>
        </div>
      )}

      {dialog === 'log' && <LogDialog onClose={() => setDialog(null)} />}
      {dialog === 'reset' && (
        <Modal
          title="¿Reiniciar el demo?"
          destructive
          confirmLabel="Reiniciar demo"
          onClose={() => setDialog(null)}
          onConfirm={() => {
            dispatch({ type: 'reset' })
            setDialog(null)
            navigate('/')
            toast({ kind: 'success', text: 'Demo reiniciado: datos, fecha, eventos, parámetros y rol volvieron al inicio.' })
          }}
        >
          Se borrarán los cambios guardados y el demo volverá al estado inicial (fecha de demo, eventos pendientes, parámetros y rol). Esta acción no se puede deshacer.
        </Modal>
      )}
    </div>
  )
}
