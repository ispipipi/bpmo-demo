import { Link, useParams } from 'react-router-dom'
import { BTN, EmptyState } from '../components/feedback'
import { PACKAGE_NOTICE } from '../domain/finding'
import { SIMULATED_LEGEND } from '../lib/csv'
import { formatDate } from '../lib/dates'
import { APP_NAME } from '../config'
import { useStore } from '../store/StoreProvider'

/** Hoja imprimible: acta de evaluación o paquete para presentación (Analista y Legal, MD §6.5.2). */
export default function FindingPrintPage({ kind }: { kind: 'acta' | 'paquete' }) {
  const { id = '' } = useParams()
  const { state } = useStore()
  const f = state.data.findings.find((x) => x.id === id)
  const back = `/mpi/hallazgo/${id}`

  if (!f || (kind === 'acta' && !f.evaluatedAt) || (kind === 'paquete' && !f.packageGeneratedAt)) {
    return (
      <div className="flex flex-col gap-5">
        <Link to={back} className="inline-flex w-fit text-label text-brand">← Volver al hallazgo</Link>
        <EmptyState
          title={kind === 'acta' ? 'El acta aún no está disponible' : 'El paquete aún no está disponible'}
          text={kind === 'acta' ? 'El acta se genera al completar la evaluación y avanzar a "Plan de corrección".' : 'El paquete se genera en la etapa "Paquete listo".'}
        />
      </div>
    )
  }

  const Row = ({ k, v }: { k: string; v: string }) => (
    <div className="flex gap-4 border-t border-line-soft py-2 text-[13.5px] first:border-t-0"><dt className="w-[190px] flex-none text-ink-soft">{k}</dt><dd className="font-semibold">{v}</dd></div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between" data-no-print>
        <Link to={back} className="text-label text-brand">← Volver al hallazgo</Link>
        <button type="button" className={BTN.primary} onClick={() => window.print()}>Imprimir o guardar como PDF</button>
      </div>
      <article className="mx-auto w-full max-w-[880px] rounded-[6px] bg-white p-10 shadow-card print:shadow-none" aria-label={kind === 'acta' ? 'Acta de evaluación' : 'Paquete para presentación'}>
        <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-4">
          <div>
            <p className="text-overline text-ink-soft">{APP_NAME} · AUTODENUNCIA (P19) · FLUJO HIPOTÉTICO</p>
            <h1 className="mt-1 text-h1">{kind === 'acta' ? 'Acta de evaluación' : 'Paquete para presentación'}</h1>
            <p className="mt-1 text-dense text-ink-soft">{f.id} · Fecha de demo {formatDate(state.clock)}</p>
          </div>
          <img src={`${import.meta.env.BASE_URL}h2d-logo.png`} alt="H2D" width={56} height={56} className="h-14 w-14 object-contain" />
        </header>

        <section className="mt-5">
          <h2 className="text-h3">Hallazgo</h2>
          <dl className="mt-2">
            <Row k="Descripción" v={f.description} />
            <Row k="Origen" v={f.originRef ? `${f.origin} (${f.originRef})` : f.origin} />
            <Row k="Fecha de detección" v={formatDate(f.detectedAt)} />
          </dl>
        </section>

        <section className="mt-5">
          <h2 className="text-h3">Evaluación</h2>
          <dl className="mt-2">
            <Row k="Gravedad" v={f.severity ?? '—'} />
            <Row k="Datos afectados" v={f.affectedData ?? '—'} />
            <Row k="Titulares estimados" v={f.holdersEstimate === null ? '—' : String(f.holdersEstimate)} />
            <Row k="Causa" v={f.cause ?? '—'} />
            <Row k="Fecha del acta" v={f.evaluatedAt ? formatDate(f.evaluatedAt) : '—'} />
          </dl>
        </section>

        {kind === 'paquete' && (
          <>
            <section className="mt-5">
              <h2 className="text-h3">Plan de corrección</h2>
              <table className="mt-2 w-full text-left text-[13.5px]">
                <thead className="bg-sunken text-label text-ink-soft"><tr><th className="px-3 py-2">Acción</th><th className="px-3 py-2">Responsable</th><th className="px-3 py-2">Fecha comprometida</th></tr></thead>
                <tbody>
                  {f.plan.map((a) => <tr key={a.id} className="border-t border-line-soft"><td className="px-3 py-2">{a.action}</td><td className="px-3 py-2">{a.owner}</td><td className="px-3 py-2 font-mono">{formatDate(a.dueAt)}</td></tr>)}
                </tbody>
              </table>
            </section>
            <section className="mt-5">
              <h2 className="text-h3">Aprobación interna</h2>
              <dl className="mt-2">
                <Row k="Aprobó" v={f.approval?.by ?? '—'} />
                <Row k="Fecha" v={f.approval ? formatDate(f.approval.date) : '—'} />
                <Row k="Referencia" v={f.approval?.ref ?? '—'} />
              </dl>
            </section>
            <p className="mt-6 rounded-ctl bg-sunken px-4 py-3 text-[13.5px]">{PACKAGE_NOTICE}.</p>
            <p className="mt-2 text-[12.5px] text-ink-soft">Paquete generado el {formatDate(f.packageGeneratedAt ?? '')}.</p>
          </>
        )}

        <footer className="mt-8 border-t border-line-soft pt-3 text-[12px] text-ink-soft">{SIMULATED_LEGEND}</footer>
      </article>
    </div>
  )
}
