import { Link, useParams } from 'react-router-dom'
import { BTN, EmptyState } from '../components/feedback'
import { StateShape } from '../components/StatusChip'
import { APP_NAME } from '../config'
import { buildActa } from '../domain/committee'
import { SIMULATED_LEGEND } from '../lib/csv'
import { formatDate } from '../lib/dates'
import { useStore } from '../store/StoreProvider'

/** Acta del comité: agenda y acuerdos con responsables, cumplidos y vencidos. Evidencia requerida de P9. */
export default function CommitteeActaPage() {
  const { sessionId = '' } = useParams()
  const { state } = useStore()
  const acta = buildActa(state, sessionId)
  if (!acta) {
    return (
      <div className="flex flex-col gap-5">
        <Link to="/comites" className="inline-flex w-fit text-label text-brand">← Volver a comités</Link>
        <EmptyState title="No existe la sesión" text="Revisa el identificador o vuelve al comité." />
      </div>
    )
  }
  const { session } = acta
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between" data-no-print>
        <Link to="/comites" className="text-label text-brand">← Volver a comités</Link>
        <button type="button" className={BTN.primary} onClick={() => window.print()}>Imprimir o guardar como PDF</button>
      </div>
      <article className="mx-auto w-full max-w-[880px] rounded-[6px] bg-white p-10 shadow-card print:shadow-none" aria-label="Acta de la sesión">
        <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-4">
          <div>
            <p className="text-overline text-ink-soft">{APP_NAME} · GESTIÓN DE COMITÉS (P9)</p>
            <h1 className="mt-1 text-h1">Acta de la sesión</h1>
            <p className="mt-1 text-dense text-ink-soft">{state.data.committee.name} · sesión del {formatDate(session.date)}{session.status === 'Próxima' ? ' (próxima)' : ''} · fecha de demo {formatDate(state.clock)}</p>
          </div>
          <img src={`${import.meta.env.BASE_URL}h2d-logo.png`} alt="H2D" width={56} height={56} className="h-14 w-14 object-contain" />
        </header>

        <section className="mt-5">
          <h2 className="text-h3">Agenda</h2>
          {session.agenda.length === 0 ? <p className="mt-2 text-dense text-ink-soft">Sin puntos en la agenda.</p> : <ol className="mt-2 list-decimal pl-5 text-[13.5px]">{session.agenda.map((a, i) => <li key={i} className="py-0.5">{a}</li>)}</ol>}
          {session.convocation && <p className="mt-2 text-[13px] text-ink-soft">Convocatoria (simulada): {session.convocation.time} · {session.convocation.place} · Asistentes: {session.convocation.attendees}</p>}
        </section>

        <section className="mt-5">
          <h2 className="text-h3">Acuerdos</h2>
          <p className="mt-1 text-[13px] text-ink-soft">{acta.agreements.length} acuerdos · {acta.fulfilled} cumplidos · {acta.overdue} vencidos</p>
          {acta.agreements.length === 0 ? (
            <p className="mt-3 rounded-ctl bg-sunken px-3 py-3 text-dense text-ink-soft">Esta sesión no registra acuerdos.</p>
          ) : (
            <table className="mt-2 w-full text-left text-[13.5px]">
              <thead className="bg-sunken text-label text-ink-soft"><tr><th className="px-3 py-2">ID</th><th className="px-3 py-2">Acuerdo</th><th className="px-3 py-2">Responsable</th><th className="px-3 py-2">Comprometido</th><th className="px-3 py-2">Estado</th></tr></thead>
              <tbody>
                {acta.agreements.map(({ agreement: a, status }) => (
                  <tr key={a.id} className="border-t border-line-soft align-top">
                    <td className="px-3 py-2 font-mono">{a.id}</td>
                    <td className="px-3 py-2">{a.description}{a.followUps.at(-1) && <div className="text-[12px] text-ink-soft">Seguimiento {formatDate(a.followUps.at(-1)!.date)}: {a.followUps.at(-1)!.text}</div>}</td>
                    <td className="px-3 py-2">{a.owner}</td>
                    <td className="px-3 py-2 font-mono">{formatDate(a.dueAt)}</td>
                    <td className="px-3 py-2"><span className="inline-flex items-center gap-1.5 font-semibold">{status === 'Vencido' && <StateShape tone="crit" size={9} />}{status === 'Cumplido' && <StateShape tone="ok" size={9} />}{status === 'Pendiente' && <StateShape tone="na" size={9} />}{status}{status === 'Cumplido' && a.doneAt ? ` ${formatDate(a.doneAt)}` : ''}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <footer className="mt-8 border-t border-line-soft pt-3 text-[12px] text-ink-soft">{SIMULATED_LEGEND}</footer>
      </article>
    </div>
  )
}
