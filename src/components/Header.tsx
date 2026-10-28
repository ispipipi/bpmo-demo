import { useNavigate } from 'react-router-dom'
import { ROLE_LABEL, type Role } from '../domain/role'
import { canWrite } from '../domain/permissions'
import type { DemoState } from '../domain/types'
import { Breadcrumbs } from './Breadcrumbs'
import { DemoClockChip } from './DemoClockChip'
import { DemoControl } from './DemoControl'
import { IconMenu, IconPanel } from './Icons'
import { LeyDeDatosStatus } from './LeyDeDatosStatus'
import { SyncButton } from './SyncButton'

const ROLES: readonly Role[] = ['analista', 'legal']

export function Header({
  state,
  drawerMode,
  onToggleSidebar,
  onRoleChange,
}: {
  state: DemoState
  drawerMode: boolean
  onToggleSidebar: () => void
  onRoleChange: (r: Role) => void
}) {
  const navigate = useNavigate()
  const { role } = state
  return (
    <header className="sticky top-0 z-20 flex h-[68px] flex-none items-center gap-2 border-b border-line-soft bg-canvas px-4 min-[640px]:gap-3 min-[900px]:px-6 min-[1200px]:px-8">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={drawerMode ? 'Abrir menú' : 'Plegar o desplegar menú'}
        className="grid h-10 w-10 flex-none place-items-center rounded-ctl bg-surface shadow-card hover:bg-sunken"
      >
        {drawerMode ? <IconMenu size={18} /> : <IconPanel size={18} />}
      </button>
      <div className="hidden min-w-8 flex-1 min-[640px]:block"><Breadcrumbs /></div>
      <div className="flex-1 min-[640px]:hidden" />
      <LeyDeDatosStatus state={state} />
      {canWrite(role) && <SyncButton />}
      <DemoClockChip clock={state.clock} />
      <div role="group" aria-label="Rol" className="flex h-10 flex-none rounded-ctl bg-surface p-1 shadow-card">
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={role === r}
            onClick={() => {
              if (r === role) return
              onRoleChange(r)
              navigate('/')
            }}
            aria-label={ROLE_LABEL[r]}
            className={`whitespace-nowrap rounded-[7px] px-2.5 text-[15px] font-bold min-[640px]:px-3 ${role === r ? 'bg-brand-soft text-brand-deep' : 'text-ink-soft hover:text-ink'}`}
          >
            <span className="min-[640px]:hidden" aria-hidden="true">{r === 'analista' ? 'Analista' : 'Legal'}</span>
            <span className="hidden min-[640px]:inline">{ROLE_LABEL[r]}</span>
          </button>
        ))}
      </div>
      <DemoControl />
    </header>
  )
}
