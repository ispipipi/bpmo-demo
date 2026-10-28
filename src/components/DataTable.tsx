import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState, Skeleton } from './feedback'
import { IconChevronRight } from './Icons'

export type Column<T> = {
  key: string
  header: string
  /** Ancho CSS (p. ej. "120px"); sin valor, la columna se reparte el resto. */
  width?: string
  align?: 'left' | 'right' | 'center'
  sort?: (a: T, b: T) => number
  render: (row: T) => ReactNode
}

type Sort = { key: string; dir: 'asc' | 'desc' } | null
const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const

/** Tabla de datos (spec §C.3): cabecera ordenable, fila navegable, carga con esqueleto y vacío con acción. */
export function DataTable<T>({
  label,
  columns,
  rows,
  rowKey,
  rowHref,
  rowState,
  onRowClick,
  isRowSelected,
  loading = false,
  empty,
  footer,
}: {
  label: string
  columns: readonly Column<T>[]
  rows: readonly T[]
  rowKey: (row: T) => string
  rowHref?: (row: T) => string
  rowState?: unknown
  /** Selección en el sitio (abre un panel lateral) en lugar de navegar. */
  onRowClick?: (row: T) => void
  isRowSelected?: (row: T) => boolean
  loading?: boolean
  empty?: { title: string; text: string; action?: ReactNode }
  footer?: ReactNode
}) {
  const navigate = useNavigate()
  const [sort, setSort] = useState<Sort>(null)
  const col = sort ? columns.find((c) => c.key === sort.key) : undefined
  const shown = col?.sort ? [...rows].sort((a, b) => (sort?.dir === 'desc' ? -1 : 1) * (col.sort?.(a, b) ?? 0)) : rows

  const toggle = (c: Column<T>) => {
    if (!c.sort) return
    setSort((s) => (s?.key !== c.key ? { key: c.key, dir: 'asc' } : s.dir === 'asc' ? { key: c.key, dir: 'desc' } : null))
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-4" aria-busy="true" aria-label="Cargando">
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}
      </div>
    )
  }
  if (rows.length === 0 && empty) return <div className="p-4"><EmptyState {...empty} /></div>

  const BADGE_PRIORITY = ['sla', 'severity', 'risk', 'status']
  const [titleCol, ...rest] = columns
  const badgeCol = BADGE_PRIORITY.map((k) => rest.find((c) => c.key === k)).find(Boolean)
  const fieldCols = rest.filter((c) => c !== badgeCol && c.key !== 'actions').slice(0, 6)
  const actionCol = columns.find((c) => c.key === 'actions')

  return (
    <div>
      <ul className="flex flex-col gap-3 p-3 min-[640px]:hidden" aria-label={label}>
        {shown.map((row) => {
          const href = rowHref?.(row)
          return (
            <li
              key={rowKey(row)}
              tabIndex={href || onRowClick ? 0 : undefined}
              onClick={href ? () => navigate(href, { state: rowState }) : onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={href ? (e) => e.key === 'Enter' && navigate(href, { state: rowState }) : onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
              className={`rounded-card bg-surface p-4 shadow-[inset_0_0_0_1px_var(--line)] ${href || onRowClick ? 'cursor-pointer' : ''} ${isRowSelected?.(row) ? 'bg-brand-soft' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 text-[16px] font-bold">{titleCol?.render(row)}</div>
                {badgeCol && <div className="flex-none">{badgeCol.render(row)}</div>}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                {fieldCols.map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-[13.5px] font-bold uppercase tracking-[0.04em] text-ink-soft">{c.header}</dt>
                    <dd className="whitespace-normal text-[15px]">{c.render(row)}</dd>
                  </div>
                ))}
              </dl>
              {actionCol && <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-line-soft pt-3" onClick={(e) => e.stopPropagation()}>{actionCol.render(row)}</div>}
            </li>
          )
        })}
      </ul>
      <div className="hidden overflow-x-auto min-[640px]:block">
        <table className="w-full min-w-[900px] border-collapse text-[15px]" aria-label={label}>
          <thead>
            <tr className="h-10 bg-sunken text-[14.5px] font-bold text-ink-soft">
              {columns.map((c, i) => (
                <th
                  key={c.key}
                  scope="col"
                  style={c.width ? { width: c.width } : undefined}
                  aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : c.sort ? 'none' : undefined}
                  className={`${ALIGN[c.align ?? 'left']} px-3 first:pl-5 ${i === columns.length - 1 && rowHref ? '' : ''}`}
                >
                  {c.sort ? (
                    <button type="button" onClick={() => toggle(c)} className="inline-flex items-center gap-1 font-bold hover:text-ink">
                      {c.header}
                      {sort?.key === c.key && <span aria-hidden="true">{sort.dir === 'asc' ? '↑' : '↓'}</span>}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
              {rowHref && <th scope="col" className="w-8"><span className="sr-only">Abrir</span></th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => {
              const href = rowHref?.(row)
              return (
                <tr
                  key={rowKey(row)}
                  tabIndex={href || onRowClick ? 0 : undefined}
                  aria-selected={isRowSelected?.(row)}
                  onClick={href ? () => navigate(href, { state: rowState }) : onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={href ? (e) => e.key === 'Enter' && navigate(href, { state: rowState }) : onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
                  className={`min-h-12 border-t border-line-soft ${href || onRowClick ? 'cursor-pointer hover:bg-brand-wash' : ''} ${isRowSelected?.(row) ? 'bg-brand-soft' : ''}`}
                  style={isRowSelected?.(row) ? { boxShadow: 'inset 3px 0 0 var(--brand)' } : undefined}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`${ALIGN[c.align ?? 'left']} whitespace-nowrap px-3 py-2.5 align-middle first:pl-5`}>{c.render(row)}</td>
                  ))}
                  {href && <td className="pr-4 text-brand"><IconChevronRight size={16} /></td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {footer && <div className="border-t border-line-soft px-5 py-3 text-[14.5px] text-ink-soft">{footer}</div>}
    </div>
  )
}
