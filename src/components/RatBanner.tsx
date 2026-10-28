import { useToast, BTN } from './feedback'
import { StatusChip } from './StatusChip'
import { daysLeft, ratReviewDue, ratReviewTone } from '../domain/derive/sla'
import { canWrite } from '../domain/permissions'
import { formatDate } from '../lib/dates'
import { useStore } from '../store/StoreProvider'

/** Cabecera del RAT: versión, última actualización y revisión mensual (MD §6.4, evidencia del proceso). */
export function RatBanner() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const { rat } = state.data
  const tone = ratReviewTone(state)
  const left = daysLeft(ratReviewDue(rat, state.params), state.clock)
  const label = tone === 'crit' ? `Revisión vencida hace ${-left} d` : tone === 'warn' ? `Revisión vence en ${left} d` : `Revisión al día · vence en ${left} d`
  return (
    <section aria-label="Versión del RAT" className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-card bg-surface px-5 py-3.5 shadow-card">
      <span className="font-mono text-[15px] font-semibold">RAT versión {rat.version}</span>
      <span className="text-dense text-ink-soft">Última actualización <span className="font-mono font-semibold text-ink">{formatDate(rat.updatedAt)}</span></span>
      <span className="text-dense text-ink-soft">Última revisión mensual <span className="font-mono font-semibold text-ink">{formatDate(rat.reviewedAt)}</span></span>
      <StatusChip tone={tone} label={label} />
      {canWrite(state.role) && (
        <button
          type="button"
          className={`${BTN.ghost} ml-auto text-brand`}
          onClick={() => {
            dispatch({ type: 'rat', op: { kind: 'review' } })
            toast({ kind: 'success', text: `Revisión mensual registrada (${formatDate(state.clock)}). La versión del RAT no cambia.` })
          }}
        >
          Registrar revisión mensual
        </button>
      )}
    </section>
  )
}
