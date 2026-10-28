import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DataTable, type Column } from '../components/DataTable'
import { BTN, useToast } from '../components/feedback'
import { IconLock } from '../components/Icons'
import { ProcessFicha } from '../components/ProcessFicha'
import { FieldsDialog, HistoryList } from '../components/record'
import { SidePanel } from '../components/SidePanel'
import { StateShape, StatusChip } from '../components/StatusChip'
import { useLoading } from '../components/useLoading'
import { screening } from '../domain/derive/sla'
import { canWrite } from '../domain/permissions'
import { applyProjectOp, BLANK, projectView, QUESTIONS, validateProject, yesCount, type ProjectOp, type RiskLabel } from '../domain/projects'
import type { Tone } from '../domain/tone'
import type { Answer, Project, ScreeningAnswers } from '../domain/types'
import { formatDate } from '../lib/dates'
import { useStore } from '../store/StoreProvider'

const RISK_TONE: Record<RiskLabel, Tone> = { 'Sin evaluar': 'warn', Alto: 'crit', Medio: 'warn', Bajo: 'ok' }
const RISK_ORDER: Record<RiskLabel, number> = { 'Sin evaluar': 0, Alto: 1, Medio: 2, Bajo: 3 }
const CHANNEL_LINK = { RAT: '/rat?tab=solicitudes&nueva=1', Consentimientos: '/consentimientos', 'Proveedores y transferencias': '/proveedores' } as const
const CHANNEL_LABEL = { RAT: 'Crear solicitud RAT', Consentimientos: 'Consentimientos', 'Proveedores y transferencias': 'Proveedores' } as const

function YesNo({ n, text, value, onChange, disabled }: { n: number; text: string; value: Answer; onChange: (v: boolean) => void; disabled: boolean }) {
  return (
    <div className="flex items-center gap-3 border-b border-line-soft py-3 last:border-b-0">
      <span className="w-4 flex-none text-[14px] text-ink-soft">{n}</span>
      <p id={`q-${n}`} className="flex-1 text-dense font-semibold">{text}</p>
      {disabled ? (
        <span aria-labelledby={`q-${n}`} className="flex-none rounded-ctl bg-sunken px-3 py-2 text-[15px] font-bold">{value === null ? '—' : value ? 'Sí' : 'No'}</span>
      ) : (
        <div role="group" aria-labelledby={`q-${n}`} className="flex flex-none rounded-ctl bg-sunken p-0.5">
          {([true, false] as const).map((v) => (
            <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className={`h-10 w-12 rounded-[8px] text-[15px] font-bold ${value === v ? 'bg-surface shadow-card' : 'text-ink-soft'}`}>
              {v ? 'Sí' : 'No'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type Panel = { kind: 'new' } | { kind: 'project'; id: string } | null

export default function RiskPage() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const loading = useLoading()
  const writable = canWrite(state.role)
  const [panel, setPanel] = useState<Panel>(null)
  const [answers, setAnswers] = useState<ScreeningAnswers>(BLANK)
  const [name, setName] = useState('')
  const [lead, setLead] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [signing, setSigning] = useState(false)

  const rows = useMemo(() => state.data.projects.map((p) => ({ p, view: projectView(p) })).sort((a, b) => RISK_ORDER[a.view.risk] - RISK_ORDER[b.view.risk] || a.p.name.localeCompare(b.p.name)), [state.data.projects])
  const project = panel?.kind === 'project' ? state.data.projects.find((p) => p.id === panel.id) : undefined

  const open = (next: Panel) => {
    setPanel(next)
    setSubmitted(false)
    setName('')
    setLead('')
    setAnswers(next?.kind === 'project' ? state.data.projects.find((p) => p.id === next.id)?.answers ?? BLANK : BLANK)
  }

  const run = (op: ProjectOp, success: string): boolean => {
    const r = applyProjectOp(state, op)
    if (!r.ok) {
      toast({ kind: 'error', text: r.error })
      return false
    }
    dispatch({ type: 'project', op })
    toast({ kind: 'success', text: success })
    return true
  }

  const live = screening(answers)
  const errors = validateProject({ name, lead, answers }, panel?.kind === 'new')
  const setAnswer = (i: number, v: boolean) => setAnswers((a) => a.map((x, j) => (j === i ? v : x)) as unknown as ScreeningAnswers)

  const save = () => {
    setSubmitted(true)
    if (Object.keys(errors).length > 0) return
    if (panel?.kind === 'new') {
      if (run({ kind: 'register', name, lead, answers }, `Proyecto ${name.trim()} registrado y evaluado.`)) setPanel(null)
    } else if (project) {
      if (run({ kind: 'evaluate', id: project.id, answers }, `${project.id} evaluado: el resultado se recalculó.`)) setPanel(null)
    }
  }

  const columns: Column<(typeof rows)[number]>[] = [
    { key: 'name', header: 'Proyecto', render: ({ p }) => <><div className="font-bold">{p.name}</div><div className="text-[14px] text-ink-soft"><span className="font-mono">{p.id}</span> · {p.lead}</div></> },
    { key: 'risk', header: 'Riesgo', render: ({ view }) => <StatusChip tone={RISK_TONE[view.risk]} label={view.risk} /> },
    { key: 'result', header: 'Resultado', render: ({ view }) => (view.screening ? <span className={view.screening.requiresEipd ? 'font-bold text-crit-ink' : ''}>{view.screening.requiresEipd ? 'Requiere EIPD' : 'No requiere EIPD'}</span> : <span className="text-ink-faint">—</span>) },
    { key: 'signed', header: 'Checklist firmado', align: 'right', render: ({ p }) => (p.checklistSignedAt ? <span className="font-mono text-[15px]">{formatDate(p.checklistSignedAt)}</span> : p.evaluatedAt ? <span className="font-mono text-[15px] font-semibold text-warn-ink">Pendiente</span> : <span className="text-ink-faint">—</span>) },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1">Matriz de riesgo</h1>
        {writable && <button type="button" className={BTN.primary} onClick={() => open({ kind: 'new' })}>Registrar proyecto</button>}
      </div>
      <ProcessFicha module="/riesgo" processes={['P11']} />

      <section className="overflow-hidden rounded-card bg-surface shadow-card" aria-label="Proyectos evaluados">
        <DataTable
          label="Proyectos"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.p.id}
          onRowClick={(r) => open({ kind: 'project', id: r.p.id })}
          isRowSelected={(r) => panel?.kind === 'project' && panel.id === r.p.id}
          loading={loading}
          empty={{ title: 'Aún no hay proyectos', text: 'Registra un proyecto para autoclasificarlo con el screening.' }}
          footer={`Mostrando 1–${rows.length} de ${rows.length}`}
        />
      </section>

      {panel && (panel.kind === 'new' || project) && (
        <SidePanel
          width={420}
          title={panel.kind === 'new' ? 'Registrar proyecto' : (project?.name ?? '')}
          subtitle={panel.kind === 'new' ? <span className="text-overline">EVALUACIÓN · SCREENING</span> : <><span className="font-mono">{project?.id}</span> · Jefe de proyecto: {project?.lead}</>}
          onClose={() => setPanel(null)}
        >
          {panel.kind === 'new' && (
            <div className="grid gap-3">
              <div>
                <label htmlFor="pry-name" className="block text-[14.5px] font-bold">Nombre del proyecto *</label>
                <input id="pry-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={submitted && errors.name ? true : undefined} aria-describedby={submitted && errors.name ? 'pry-name-error' : undefined} className="mt-1.5 h-10 w-full rounded-ctl bg-surface px-3 text-[16px] shadow-[inset_0_0_0_1.5px_var(--line)]" />
                {submitted && errors.name && <p id="pry-name-error" className="mt-1.5 text-[14px] font-semibold text-crit-ink">{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="pry-lead" className="block text-[14.5px] font-bold">Jefe de proyecto *</label>
                <input id="pry-lead" value={lead} onChange={(e) => setLead(e.target.value)} aria-invalid={submitted && errors.lead ? true : undefined} aria-describedby={submitted && errors.lead ? 'pry-lead-error' : undefined} className="mt-1.5 h-10 w-full rounded-ctl bg-surface px-3 text-[16px] shadow-[inset_0_0_0_1.5px_var(--line)]" />
                {submitted && errors.lead && <p id="pry-lead-error" className="mt-1.5 text-[14px] font-semibold text-crit-ink">{errors.lead}</p>}
              </div>
            </div>
          )}

          <div>
            {QUESTIONS.map((t, i) => <YesNo key={i} n={i + 1} text={t} value={answers[i] ?? null} disabled={!writable} onChange={(v) => setAnswer(i, v)} />)}
            {submitted && errors.answers && <p role="alert" className="mt-2 flex items-center gap-1.5 text-[14px] font-semibold text-crit-ink"><StateShape tone="crit" size={9} /> {errors.answers}</p>}
          </div>

          <div className={`rounded-card p-4 ${live?.risk === 'Alto' ? 'shadow-[inset_0_0_0_1.5px_var(--crit)]' : 'bg-sunken'}`} aria-live="polite">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-overline text-ink-soft">RESULTADO</span>
              {live ? <StatusChip tone={RISK_TONE[live.risk]} label={`Riesgo ${live.risk}`} /> : null}
              {live && <span className="text-[14.5px] text-ink-soft">{yesCount(answers)} respuestas "Sí"</span>}
            </div>
            {live ? (
              <>
                <p className={`mt-2 text-[22px] font-extrabold ${live.requiresEipd ? 'text-crit-ink' : ''}`}>{live.requiresEipd ? 'Requiere EIPD' : 'No requiere EIPD'}</p>
                {live.requiresEipd && <p className="mt-2 flex items-start gap-2 rounded-ctl bg-sunken px-3 py-2 text-[15px] text-ink-soft"><IconLock size={14} className="mt-0.5 flex-none" /> La ejecución de la EIPD (proceso 14) no está incluida en este demo.</p>}
                {live.channels.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1.5 text-[14.5px] font-bold">Canales habilitados</div>
                    <div className="flex flex-wrap gap-2">
                      {live.channels.map((c) => <Link key={c} to={CHANNEL_LINK[c]} className="inline-flex h-8 items-center rounded-full bg-surface px-3 text-[14.5px] font-bold shadow-[inset_0_0_0_1.5px_var(--line)] hover:bg-sunken">{CHANNEL_LABEL[c]} ›</Link>)}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-2 text-dense text-ink-soft">Responde las 5 preguntas para ver el resultado.</p>
            )}
          </div>

          {project?.evaluatedAt && (
            <p className="text-dense text-ink-soft">Checklist firmado: {project.checklistRef ? <span className="font-mono font-semibold text-ink">{project.checklistRef} · {formatDate(project.checklistSignedAt ?? '')}</span> : <span className="font-semibold text-warn-ink">Pendiente</span>}</p>
          )}

          {writable && (
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line-soft pt-4">
              {project?.evaluatedAt && <button type="button" className={`${BTN.secondary} mr-auto`} onClick={() => setSigning(true)}>Registrar checklist firmado</button>}
              <button type="button" className={BTN.ghost} onClick={() => setPanel(null)}>Cancelar</button>
              <button type="button" className={BTN.primary} onClick={save}>{panel.kind === 'new' ? 'Registrar y evaluar' : project?.evaluatedAt ? 'Reevaluar' : 'Guardar evaluación'}</button>
            </div>
          )}

          {project && (
            <div>
              <h3 className="mb-2 border-b border-line pb-2 text-[15px] font-bold text-brand-deep">Historial</h3>
              <HistoryList entries={project.history} formatDate={formatDate} />
            </div>
          )}
        </SidePanel>
      )}

      {signing && project && (
        <FieldsDialog
          title={`Registrar checklist firmado · ${project.id}`}
          intro="Marca el screening como firmado: es la evidencia requerida del proceso."
          fields={[{ key: 'date', label: 'Fecha de la firma', kind: 'date', required: true, max: state.clock }, { key: 'ref', label: 'Referencia del documento', kind: 'text', required: true, mono: true }]}
          initial={{ date: state.clock }}
          validate={(v) => ({
            ...(/^\d{4}-\d{2}-\d{2}$/.test(v.date ?? '') && (v.date ?? '') <= state.clock ? {} : { date: 'Ingresa una fecha válida, no posterior a la fecha de demo.' }),
            ...((v.ref ?? '').trim() === '' ? { ref: 'Indica la referencia.' } : {}),
          })}
          confirmLabel="Registrar checklist"
          onClose={() => setSigning(false)}
          onSubmit={(v) => run({ kind: 'sign', id: project.id, date: v.date ?? '', ref: v.ref ?? '' }, 'Checklist firmado registrado.') && setSigning(false)}
        />
      )}
    </div>
  )
}

export type { Project }
