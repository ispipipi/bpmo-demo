import type { Approval, Approver } from '../domain/types'
import { formatDate } from '../lib/dates'
import { BTN } from './feedback'
import { IconCheck } from './Icons'
import { StateShape } from './StatusChip'

/** Tarjeta de visto bueno (spec §C.4): Pendiente, Aprobado u Observado. */
export function ApprovalCard({ approver, approval, onRegister }: { approver: Approver; approval: Approval; onRegister?: () => void }) {
  if (approval.state === 'Aprobado') {
    return (
      <div className="flex min-h-[132px] flex-col justify-between rounded-card bg-ok-soft p-3.5 text-ok-ink">
        <div>
          <div className="flex items-center gap-1.5 text-[13px] font-bold"><IconCheck size={14} /> Aprobado</div>
          <div className="mt-1 text-[14px] font-bold">{approver}</div>
        </div>
        <div className="font-mono text-[12px]">{approval.date ? formatDate(approval.date) : '—'} · {approval.ref ?? '—'}</div>
      </div>
    )
  }
  if (approval.state === 'Observado') {
    return (
      <div className="flex min-h-[132px] flex-col justify-between rounded-card bg-warn-soft p-3.5 text-warn-ink">
        <div>
          <div className="flex items-center gap-1.5 text-[13px] font-bold"><StateShape tone="warn" size={10} /> Observado</div>
          <div className="mt-1 text-[14px] font-bold">{approver}</div>
          <p className="mt-1 line-clamp-2 text-[12.5px]" title={approval.comment ?? undefined}>{approval.comment}</p>
        </div>
        <div className="font-mono text-[12px]">{approval.date ? formatDate(approval.date) : '—'} · {approval.ref ?? '—'}</div>
      </div>
    )
  }
  return (
    <div className="flex min-h-[132px] flex-col justify-between rounded-card border-[1.5px] border-dashed border-line bg-surface p-3.5">
      <div>
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft"><StateShape tone="na" size={10} /> Pendiente</div>
        <div className="mt-1 text-[14px] font-bold">{approver}</div>
      </div>
      {onRegister && <button type="button" className={`${BTN.secondary} h-8 px-3 text-[12.5px]`} onClick={onRegister}>Registrar visto bueno</button>}
    </div>
  )
}
