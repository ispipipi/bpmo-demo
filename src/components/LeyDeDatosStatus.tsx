import { formatDate } from '../lib/dates'
import type { DemoState } from '../domain/types'
import { StateShape } from './StatusChip'

export function LeyDeDatosStatus({ state }: { state: DemoState }) {
  const error = state.connectionError
  const sync = state.lastSync
  const full = error
    ? 'Ley de Datos: error de conexión (simulado)'
    : `Ley de Datos: Conectado (simulado). Última sincronización: ${sync ? `${formatDate(sync.date)} ${sync.time}` : '—'} (simulada)`
  return (
    <div className="hidden flex-none whitespace-nowrap text-xs leading-4 min-[900px]:block" title={full} aria-label={full} role="status">
      <div className="flex items-center gap-1.5 font-semibold">
        <StateShape tone={error ? 'crit' : 'ok'} size={8} />
        {error ? (
          <span className="text-crit-ink">Error de conexión (simulado)</span>
        ) : (
          <span><span className="hidden min-[1500px]:inline">Ley de Datos · </span>Conectado</span>
        )}
      </div>
      {!error && (
        <div className="hidden pl-[14px] text-ink-soft min-[1500px]:block">
          Sinc. <span className="font-mono">{sync?.time ?? '—'}</span> (simulada)
        </div>
      )}
    </div>
  )
}
