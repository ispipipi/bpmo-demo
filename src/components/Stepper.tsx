import { IconCheck } from './Icons'

/** Stepper horizontal (spec §C.4): completas con check, actual en marca, futuras en gris. Colapsa bajo 1200 px. */
export function Stepper({ stages, current }: { stages: readonly string[]; current: number }) {
  return (
    <div>
      <ol className="hidden min-[1200px]:flex" aria-label={`Etapa ${current + 1} de ${stages.length}`}>
        {stages.map((label, i) => {
          const done = i < current
          const active = i === current
          return (
            <li key={label} className="flex flex-1 flex-col last:flex-none" aria-current={active ? 'step' : undefined}>
              <div className="flex items-center">
                <span
                  className={`grid h-7 w-7 flex-none place-items-center rounded-full text-[14.5px] font-bold ${
                    done ? 'bg-ok text-white' : active ? 'bg-brand text-white' : 'bg-surface text-ink-soft shadow-[inset_0_0_0_1.5px_var(--line)]'
                  }`}
                >
                  {done ? <IconCheck size={14} /> : i + 1}
                </span>
                {i < stages.length - 1 && <span className={`mx-2 h-0.5 flex-1 ${done ? 'bg-ok' : 'bg-line'}`} />}
              </div>
              <span className={`mt-2 text-[15px] ${active ? 'font-bold text-brand-deep' : done ? 'font-semibold' : 'text-ink-soft'}`}>{label}</span>
            </li>
          )
        })}
      </ol>
      <div className="flex items-center gap-3 min-[1200px]:hidden">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-[14.5px] font-bold text-white">{current + 1}</span>
        <div className="text-[15px]">
          <div className="font-bold text-brand-deep">{stages[current]}</div>
          <div className="text-ink-soft">Etapa {current + 1} de {stages.length}</div>
        </div>
      </div>
    </div>
  )
}
