import { BTN } from './feedback'
import { IconSync } from './Icons'
import { useSync } from './useSync'

export function SyncButton() {
  const { run, running, label } = useSync()
  return (
    <button
      type="button"
      onClick={run}
      disabled={running}
      aria-label={running ? label : 'Sincronizar con Ley de Datos'}
      aria-busy={running}
      className={`${BTN.secondary} flex-none disabled:cursor-wait disabled:opacity-80`}
    >
      <IconSync size={16} className={running ? 'animate-spin' : ''} />
      <span className="hidden min-[1200px]:inline">{label}</span>
    </button>
  )
}
