import { useState } from 'react'
import { processById, type ProcessId, type Responsible } from '../domain/catalog'
import { processStatus } from '../domain/derive/tones'
import type { Tone } from '../domain/tone'
import { useStore } from '../store/StoreProvider'
import { IconBuilding, IconChevronDown, IconChevronUp, IconInfo, IconPeople, IconShield } from './Icons'
import { StatusChip } from './StatusChip'

const KEY = 'npr_bpmo_h2d_ficha_v1'

function readMap(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(KEY)
    const v: unknown = raw ? JSON.parse(raw) : {}
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

function writeMap(m: Record<string, boolean>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(m))
  } catch {
    /* sin almacenamiento: la preferencia vive solo en memoria */
  }
}

const GLOW: Record<Tone, string> = { crit: 'var(--crit-soft)', warn: 'var(--warn-soft)', ok: 'var(--ok-soft)', info: 'var(--brand-soft)', na: 'transparent' }

export function ResponsibleChip({ responsible }: { responsible: Responsible }) {
  const Icon = responsible === 'H2D' ? IconShield : responsible === 'Compartido' ? IconPeople : IconBuilding
  return (
    <span className="inline-flex h-6 flex-none items-center gap-1.5 whitespace-nowrap rounded-[6px] bg-surface px-2 text-[14px] font-semibold text-ink-soft shadow-[inset_0_0_0_1px_var(--line)]">
      <Icon size={13} />
      {responsible}
    </span>
  )
}

const Pill = ({ id }: { id: string }) => <span className="flex-none rounded-[6px] bg-sunken px-2 py-0.5 font-mono text-[15px] font-semibold">{id}</span>

/** Ficha del proceso (AC-23): plegada para Analista, abierta para Legal; se recuerda por módulo. */
export function ProcessFicha({ module, processes, notice }: { module: string; processes: readonly ProcessId[]; notice?: string }) {
  const { state } = useStore()
  const [open, setOpen] = useState(() => readMap()[module] ?? state.role === 'legal')
  const defs = processes.map((id) => ({ def: processById(id), status: processStatus(id, state) }))
  const first = defs[0]
  if (!first) return null
  const worst: Tone = defs.some((d) => d.status.tone === 'crit') ? 'crit' : defs.some((d) => d.status.tone === 'warn') ? 'warn' : first.status.tone

  const toggle = () => {
    const next = !open
    setOpen(next)
    writeMap({ ...readMap(), [module]: next })
  }

  return (
    <section
      aria-label="Ficha del proceso"
      className="rounded-card bg-surface shadow-card"
      style={{ background: `radial-gradient(640px 260px at 0 0, ${GLOW[worst]}, transparent 70%), var(--surface)` }}
    >
      <button type="button" onClick={toggle} aria-expanded={open} className="flex min-h-[52px] w-full items-center gap-3 px-5 py-2 text-left">
        {open ? (
          <span className="text-overline text-ink-soft">FICHA DEL PROCESO</span>
        ) : (
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
            {defs.map(({ def, status }) => (
              <span key={def.id} className="flex min-w-0 items-center gap-2">
                <Pill id={def.id} />
                {defs.length === 1 && <span className="truncate text-[15px] font-bold">{def.name}</span>}
                {defs.length === 1 && <ResponsibleChip responsible={def.responsible} />}
                {defs.length === 1 && <span className="hidden truncate text-[15px] text-ink-soft min-[1200px]:inline">{def.trigger}</span>}
                <StatusChip tone={status.tone} label={status.label} />
              </span>
            ))}
          </span>
        )}
        {open && <span className="flex-1" />}
        <span className="inline-flex flex-none items-center gap-1 text-[14.5px] font-bold text-brand">
          {open ? 'Ocultar ficha' : 'Ver ficha'}
          {open ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        </span>
      </button>

      {notice && (
        <p className="mx-5 mb-4 flex items-center gap-2 rounded-ctl bg-warn-soft px-3 py-2 text-dense text-warn-ink"><IconInfo size={15} className="flex-none" /> {notice}</p>
      )}

      {open && (
        <div className="px-5 pb-5">
          {defs.map(({ def, status }, i) => (
            <div key={def.id} className={i > 0 ? 'mt-4 border-t border-line-soft pt-4' : ''}>
              <div className="flex flex-wrap items-center gap-3">
                <Pill id={def.id} />
                <h2 className="text-h3">{def.name}</h2>
                <StatusChip tone={status.tone} label={status.label} size="md" />
              </div>
              <div className="mt-1 text-[15px] text-ink-soft">{def.category}</div>
              <dl className="mt-3 grid grid-cols-1 gap-4 border-t border-line-soft pt-3 min-[900px]:grid-cols-[1fr_1fr_1.5fr]">
                <div>
                  <dt className="text-overline text-ink-soft">PERIODICIDAD / GATILLO</dt>
                  <dd className="mt-1 text-dense">{def.trigger}</dd>
                </div>
                <div>
                  <dt className="text-overline text-ink-soft">RESPONSABLE PRINCIPAL</dt>
                  <dd className="mt-1"><ResponsibleChip responsible={def.responsible} /></dd>
                </div>
                <div>
                  <dt className="text-overline text-ink-soft">EVIDENCIA REQUERIDA</dt>
                  <dd className="mt-1 text-dense">{def.evidence}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
