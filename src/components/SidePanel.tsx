import { useEffect, useRef, type ReactNode } from 'react'
import { IconClose } from './Icons'

/** Panel lateral de detalle (spec §C.3): role=dialog, Esc cierra y el foco vuelve a la fila. */
export function SidePanel({
  title,
  subtitle,
  chip,
  onClose,
  width = 380,
  children,
}: {
  title: string
  subtitle?: ReactNode
  chip?: ReactNode
  onClose: () => void
  width?: number
  children: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('button')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [onClose])

  return (
    <aside
      ref={ref}
      role="dialog"
      aria-label={title}
      className="animate-drawer fixed right-0 top-0 z-40 flex h-screen w-full flex-col overflow-y-auto bg-surface p-6 print:hidden"
      style={{ maxWidth: width, boxShadow: '-1px 0 0 var(--line), -24px 0 48px -24px rgba(32,26,44,.25)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[20px] font-extrabold leading-6">{title}</h2>
          {subtitle && <div className="mt-0.5 text-[15px] text-ink-soft">{subtitle}</div>}
        </div>
        <button type="button" aria-label="Cerrar panel" onClick={onClose} className="grid h-8 w-8 flex-none place-items-center rounded-ctl text-ink-soft hover:bg-sunken">
          <IconClose size={16} />
        </button>
      </div>
      {chip && <div className="mt-3">{chip}</div>}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </aside>
  )
}

export const PanelPairs = ({ pairs }: { pairs: readonly (readonly [string, ReactNode])[] }) => (
  <dl>
    {pairs.map(([k, v]) => (
      <div key={k} className="flex justify-between gap-4 border-t border-line-soft py-2.5 text-dense first:border-t-0">
        <dt className="text-ink-soft">{k}</dt>
        <dd className="text-right font-bold">{v}</dd>
      </div>
    ))}
  </dl>
)
