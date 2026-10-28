import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { IconCheck, IconClose, IconInfo } from './Icons'
import { StateShape } from './StatusChip'

/* ---------- Botones (MD/README: variantes) ---------- */

export const BTN = {
  primary:
    'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-ctl bg-brand px-[18px] text-[15px] font-bold text-white transition hover:bg-brand-deep active:translate-y-px',
  secondary:
    'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-ctl bg-surface px-4 text-[15px] font-bold shadow-[inset_0_0_0_1.5px_var(--line)] transition hover:bg-sunken active:translate-y-px',
  danger:
    'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-ctl bg-surface px-4 text-[15px] font-bold text-crit-ink shadow-[inset_0_0_0_1.5px_var(--crit)] transition hover:bg-crit-soft active:translate-y-px',
  ghost:
    'inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-ctl px-2 text-[14.5px] font-bold text-ink-soft transition hover:bg-sunken hover:text-ink',
} as const

/* ---------- Estados de interfaz ---------- */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton animate-shimmer rounded-ctl ${className}`} />
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-card border-[1.5px] border-dashed border-line px-6 py-10 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-ctl bg-sunken text-ink-soft">
        <IconInfo size={22} />
      </div>
      <h3 className="text-[20px] font-extrabold">{title}</h3>
      <p className="mt-1 max-w-md text-dense text-ink-soft">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** Acción no disponible: botón inerte + motivo visible (AC-05, AC-06). */
export function BlockedAction({ label, reasons }: { label: string; reasons: readonly string[] }) {
  const id = useId()
  return (
    <div>
      <button
        type="button"
        aria-disabled="true"
        aria-describedby={id}
        onClick={(e) => e.preventDefault()}
        className="inline-flex h-10 cursor-not-allowed items-center whitespace-nowrap rounded-ctl bg-sunken px-4 text-[15px] font-bold text-ink-faint"
      >
        {label}
      </button>
      <p id={id} className="mt-2 flex items-start gap-1.5 text-[14.5px] text-ink-soft">
        <IconInfo size={14} className="mt-0.5 flex-none" />
        <span>{reasons.join(' ')}</span>
      </p>
    </div>
  )
}

/* ---------- Modal con foco atrapado ---------- */

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function Modal({
  title,
  children,
  onClose,
  onConfirm,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive = false,
  confirmDisabled = false,
  variant = 'confirm',
}: {
  title: string
  children: ReactNode
  onClose: () => void
  onConfirm?: () => void
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  confirmDisabled?: boolean
  variant?: 'confirm' | 'form' | 'wide'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const node = ref.current
    node?.querySelector<HTMLElement>('input,select,textarea')?.focus() ?? node?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    return () => previous?.focus()
  }, [])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !ref.current) return
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE))
    const first = items[0]
    const last = items[items.length - 1]
    if (!first || !last) return
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: 'var(--scrim)' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className={`animate-rise max-h-[calc(100vh-32px)] w-full overflow-auto rounded-card bg-surface p-6 shadow-float ${variant === 'wide' ? 'max-w-[760px]' : variant === 'form' ? 'max-w-[520px]' : 'max-w-[440px]'}`}
      >
        <h2 id={titleId} className="text-h2">{title}</h2>
        <div className="mt-3 text-body text-ink-soft">{children}</div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className={BTN.secondary} onClick={onClose}>{onConfirm ? cancelLabel : 'Cerrar'}</button>
          {onConfirm && (
            <button type="button" className={destructive ? BTN.danger : BTN.primary} disabled={confirmDisabled} onClick={onConfirm}>
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- Toasts ---------- */

type ToastInput = { kind: 'success' | 'error'; text: string; action?: { label: string; run: () => void } }
type ToastItem = ToastInput & { id: number }

const ToastCtx = createContext<((t: ToastInput) => void) | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), [])
  const push = useCallback(
    (t: ToastInput) => {
      const id = ++seq.current
      setItems((xs) => [...xs, { ...t, id }])
      if (t.kind === 'success') window.setTimeout(() => dismiss(id), 5000)
    },
    [dismiss],
  )
  const value = useMemo(() => push, [push])
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-3" data-no-print>
        {items.map((t) => (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className="animate-rise pointer-events-auto flex items-start gap-3 rounded-card bg-surface p-4 shadow-float">
            <span className="mt-0.5 flex-none">{t.kind === 'success' ? <IconCheck size={18} className="text-ok" /> : <StateShape tone="crit" size={14} />}</span>
            <div className="min-w-0 flex-1 text-dense">
              {t.text}
              {t.action && (
                <button type="button" className="mt-2 block text-label text-brand hover:text-brand-deep" onClick={() => { t.action?.run(); dismiss(t.id) }}>
                  {t.action.label}
                </button>
              )}
            </div>
            <button type="button" aria-label="Cerrar aviso" className="flex-none rounded p-1 text-ink-soft hover:bg-sunken" onClick={() => dismiss(t.id)}>
              <IconClose size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const v = useContext(ToastCtx)
  if (!v) throw new Error('useToast fuera de ToastProvider')
  return v
}
