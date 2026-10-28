import { formatDate } from '../lib/dates'
import { IconCalendar } from './Icons'

/** El destello se reinicia al cambiar la fecha (la key remonta el chip). */
export function DemoClockChip({ clock }: { clock: string }) {
  return (
    <div
      key={clock}
      className="flex h-10 flex-none animate-flash items-center gap-2 whitespace-nowrap rounded-ctl bg-surface px-2.5 shadow-card min-[640px]:px-3"
      title="Fecha del reloj de demo"
    >
      <IconCalendar size={16} className="hidden text-ink-soft min-[640px]:block" />
      <span className="hidden text-[13px] text-ink-soft min-[900px]:inline">Fecha demo</span>
      <span className="font-mono text-[13px] font-semibold" data-testid="demo-clock">{formatDate(clock)}</span>
    </div>
  )
}
