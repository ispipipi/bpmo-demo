import { formatDate } from '../lib/dates'
import { nextId } from './ids'
import { withLog } from './log'
import { err, ok, type Result } from './result'
import { FINDING_STAGES, type DemoState, type Finding, type FindingSeverity, type FindingStage, type HistoryEntry } from './types'

const ACTOR = 'Analista PMO'
export const MIN_TEXT = 10
export const ESVAL_AREAS = ['TI de Sanitor', 'Legal de Sanitor', 'Recursos Humanos de Sanitor', 'Operaciones de Sanitor', 'Atención a clientes de Sanitor', 'Compras de Sanitor'] as const
export const SEVERITIES: readonly FindingSeverity[] = ['Baja', 'Media', 'Alta']
export const PACKAGE_NOTICE = 'H2D prepara el paquete; la presentación ante la Agencia la realiza quien ejerce como DPD formal (en este demo, el DPD de Sanitor)'
export const HYPOTHETICAL_NOTICE = 'Flujo hipotético a validar: la Agencia aún no opera y no hay reglamentación operativa.'

export type FindingOp =
  | { kind: 'create'; origin: 'Ítem MPI' | 'Manual'; originRef: string | null; description: string }
  | { kind: 'evaluate'; id: string; severity: FindingSeverity | ''; affectedData: string; holdersEstimate: string; cause: string }
  | { kind: 'planAdd'; id: string; action: string; owner: string; dueAt: string }
  | { kind: 'planRemove'; id: string; actionId: string }
  | { kind: 'approve'; id: string; by: string; date: string; ref: string }
  | { kind: 'package'; id: string }
  | { kind: 'file'; id: string; by: string; date: string; ref: string }
  | { kind: 'actionDone'; id: string; actionId: string; done: boolean }
  | { kind: 'advance'; id: string }
  | { kind: 'retreat'; id: string; reason: string }
  | { kind: 'close'; id: string; result: string }

export const stageIndex = (s: FindingStage): number => FINDING_STAGES.indexOf(s)
export const isFindingEditable = (f: Finding): boolean => f.stage !== 'Cerrado'
/** "Retroceder etapa" no existe en Detectado, Presentada (la constancia ya existe) ni Cerrado. */
export const canRetreat = (f: Finding): boolean => f.stage !== 'Detectado' && f.stage !== 'Presentada' && f.stage !== 'Cerrado'

const filled = (v: string | null | undefined) => (v ?? '').trim() !== ''
const validDate = (s: DemoState, d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= s.clock

export type EvaluationErrors = Partial<Record<'severity' | 'affectedData' | 'holdersEstimate' | 'cause', string>>
export function validateEvaluation(o: { severity: string; affectedData: string; holdersEstimate: string; cause: string }): EvaluationErrors {
  const e: EvaluationErrors = {}
  if (!(SEVERITIES as readonly string[]).includes(o.severity)) e.severity = 'Elige la gravedad.'
  if (!filled(o.affectedData)) e.affectedData = 'Indica los datos afectados.'
  const n = Number(o.holdersEstimate)
  if (o.holdersEstimate.trim() === '' || !Number.isInteger(n) || n < 0) e.holdersEstimate = 'Ingresa la cantidad estimada de titulares (número entero).'
  if (!filled(o.cause)) e.cause = 'Indica la causa.'
  return e
}

export type SignoffErrors = Partial<Record<'by' | 'date' | 'ref', string>>
/** Aprobación interna y constancia de presentación: quién, cuándo y referencia, los tres obligatorios (AC-09). */
export function validateSignoff(s: DemoState, o: { by: string; date: string; ref: string }): SignoffErrors {
  const e: SignoffErrors = {}
  if (!filled(o.by)) e.by = 'Indica quién.'
  if (!validDate(s, o.date)) e.date = 'Ingresa una fecha válida, no posterior a la fecha de demo.'
  if (!filled(o.ref)) e.ref = 'Ingresa la referencia del respaldo para continuar.'
  return e
}

export type ActionErrors = Partial<Record<'action' | 'owner' | 'dueAt', string>>
export function validateAction(o: { action: string; owner: string; dueAt: string }): ActionErrors {
  const e: ActionErrors = {}
  if (!filled(o.action)) e.action = 'Describe la acción.'
  if (!filled(o.owner)) e.owner = 'Indica el área de Sanitor responsable.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.dueAt)) e.dueAt = 'Indica la fecha comprometida.'
  return e
}

export const validateDescription = (t: string): string | null => (t.trim().length >= MIN_TEXT ? null : `La descripción debe tener al menos ${MIN_TEXT} caracteres.`)
export const validateReason = (t: string): string | null => (t.trim().length >= MIN_TEXT ? null : `El motivo debe tener al menos ${MIN_TEXT} caracteres.`)

/** Qué falta para salir de la etapa actual (MD §6.5.2, AC-08). Vacío = se puede avanzar. */
export function advanceBlockers(f: Finding): string[] {
  switch (f.stage) {
    case 'Detectado':
      return validateDescription(f.description) ? ['Completa la descripción del hallazgo.'] : []
    case 'En evaluación': {
      const missing = [
        f.severity === null && 'gravedad',
        !filled(f.affectedData) && 'datos afectados',
        f.holdersEstimate === null && 'cantidad estimada de titulares',
        !filled(f.cause) && 'causa',
      ].filter(Boolean)
      return missing.length > 0 ? [`Completa la evaluación: falta ${missing.join(', ')}.`] : []
    }
    case 'Plan de corrección':
      return f.plan.length === 0 ? ['Agrega al menos una acción al plan de corrección.'] : []
    case 'Aprobación interna':
      return f.approval ? [] : ['Registra la aprobación interna del DPD o Legal de Sanitor.']
    case 'Paquete listo':
      return f.packageGeneratedAt ? [] : ['Genera el paquete antes de registrar su presentación.']
    case 'Presentada':
      return f.filing ? [] : ['Registra la constancia de presentación: quién presentó, fecha y referencia del respaldo.']
    case 'En seguimiento': {
      const open = f.plan.filter((a) => !a.done).length
      return open > 0 ? [`Faltan ${open} de ${f.plan.length} acciones del plan por completar.`] : []
    }
    case 'Cerrado':
      return ['El caso está cerrado.']
  }
}

const note = (s: DemoState, f: Finding, text: string): Finding => ({ ...f, history: [...f.history, { date: s.clock, actor: ACTOR, text } satisfies HistoryEntry] })

function edit(s: DemoState, id: string, change: (f: Finding) => Finding | string, log: string): Result<DemoState, string> {
  const f = s.data.findings.find((x) => x.id === id)
  if (!f) return err(`No existe el hallazgo ${id}.`)
  const next = change(f)
  if (typeof next === 'string') return err(next)
  return ok(withLog({ ...s, data: { ...s.data, findings: s.data.findings.map((x) => (x.id === id ? next : x)) } }, log, id))
}

const needStage = (f: Finding, ...stages: FindingStage[]): string | null =>
  f.stage === 'Cerrado' ? 'El caso está cerrado.' : stages.includes(f.stage) ? null : `Esta acción corresponde a la etapa "${stages[0]}".`

export function applyFindingOp(s: DemoState, op: FindingOp): Result<DemoState, string> {
  switch (op.kind) {
    case 'create': {
      const bad = validateDescription(op.description)
      if (bad) return err(bad)
      const id = nextId('HAL', s.data.findings.map((f) => f.id), 4)
      const f: Finding = {
        id,
        origin: op.origin,
        originRef: op.originRef,
        description: op.description.trim(),
        detectedAt: s.clock,
        stage: 'Detectado',
        severity: null,
        affectedData: null,
        holdersEstimate: null,
        cause: null,
        plan: [],
        approval: null,
        evaluatedAt: null,
        packageGeneratedAt: null,
        filing: null,
        closedAt: null,
        closeResult: null,
        history: [{ date: s.clock, actor: ACTOR, text: op.originRef ? `Hallazgo registrado desde ${op.originRef}` : 'Hallazgo registrado manualmente' }],
      }
      return ok(withLog({ ...s, data: { ...s.data, findings: [...s.data.findings, f] } }, `Registró el hallazgo ${id}`, id))
    }

    case 'evaluate':
      return edit(
        s,
        op.id,
        (f) => {
          const wrong = needStage(f, 'En evaluación')
          if (wrong) return wrong
          const bad = Object.values(validateEvaluation(op))[0]
          if (bad) return bad
          return note(s, { ...f, severity: op.severity as FindingSeverity, affectedData: op.affectedData.trim(), holdersEstimate: Number(op.holdersEstimate), cause: op.cause.trim() }, `Evaluación guardada: gravedad ${op.severity}`)
        },
        'Guardó la evaluación',
      )

    case 'planAdd':
      return edit(
        s,
        op.id,
        (f) => {
          const wrong = needStage(f, 'Plan de corrección')
          if (wrong) return wrong
          const bad = Object.values(validateAction(op))[0]
          if (bad) return bad
          const id = `${f.id}-A${f.plan.reduce((m, a) => Math.max(m, Number(a.id.split('-A')[1]) || 0), 0) + 1}`
          return note(s, { ...f, plan: [...f.plan, { id, action: op.action.trim(), owner: op.owner.trim(), dueAt: op.dueAt, done: false }] }, `Acción agregada al plan: ${op.action.trim()} (${op.owner.trim()}, ${formatDate(op.dueAt)})`)
        },
        'Agregó una acción al plan',
      )

    case 'planRemove':
      return edit(
        s,
        op.id,
        (f) => {
          const wrong = needStage(f, 'Plan de corrección')
          if (wrong) return wrong
          if (!f.plan.some((a) => a.id === op.actionId)) return 'No existe la acción.'
          return note(s, { ...f, plan: f.plan.filter((a) => a.id !== op.actionId) }, 'Acción quitada del plan')
        },
        'Quitó una acción del plan',
      )

    case 'approve':
      return edit(
        s,
        op.id,
        (f) => {
          const wrong = needStage(f, 'Aprobación interna')
          if (wrong) return wrong
          const bad = Object.values(validateSignoff(s, op))[0]
          if (bad) return bad
          return note(s, { ...f, approval: { by: op.by.trim(), date: op.date, ref: op.ref.trim() } }, `Aprobación interna registrada: ${op.by.trim()} (${op.ref.trim()})`)
        },
        'Registró la aprobación interna',
      )

    case 'package':
      return edit(
        s,
        op.id,
        (f) => {
          const wrong = needStage(f, 'Paquete listo')
          if (wrong) return wrong
          return note(s, { ...f, packageGeneratedAt: s.clock }, 'Paquete para presentación generado')
        },
        'Generó el paquete',
      )

    case 'file':
      return edit(
        s,
        op.id,
        (f) => {
          const wrong = needStage(f, 'Presentada')
          if (wrong) return wrong
          const bad = Object.values(validateSignoff(s, op))[0]
          if (bad) return bad
          return note(s, { ...f, filing: { by: op.by.trim(), date: op.date, ref: op.ref.trim() } }, `Constancia de presentación registrada: ${op.by.trim()}, ${formatDate(op.date)} (${op.ref.trim()})`)
        },
        'Registró la constancia de presentación',
      )

    case 'actionDone':
      return edit(
        s,
        op.id,
        (f) => {
          const wrong = needStage(f, 'En seguimiento')
          if (wrong) return wrong
          const a = f.plan.find((x) => x.id === op.actionId)
          if (!a) return 'No existe la acción.'
          return note(s, { ...f, plan: f.plan.map((x) => (x.id === a.id ? { ...x, done: op.done } : x)) }, `Acción "${a.action}": ${op.done ? 'completa' : 'pendiente'}`)
        },
        'Actualizó una acción del plan',
      )

    case 'advance':
      return edit(
        s,
        op.id,
        (f) => {
          if (f.stage === 'En seguimiento') return 'Cierra el caso registrando su resultado.'
          const blockers = advanceBlockers(f)
          if (blockers.length > 0) return blockers.join(' ')
          const next = FINDING_STAGES[stageIndex(f.stage) + 1]
          if (!next) return 'El caso está cerrado.'
          const moved: Finding = { ...f, stage: next, evaluatedAt: f.stage === 'En evaluación' ? s.clock : f.evaluatedAt }
          return note(s, moved, `Etapa: ${f.stage} → ${next}${f.stage === 'En evaluación' ? '. Acta de evaluación generada' : ''}`)
        },
        'Avanzó de etapa',
      )

    case 'retreat':
      return edit(
        s,
        op.id,
        (f) => {
          if (!canRetreat(f)) return f.stage === 'Presentada' ? 'No se puede retroceder desde "Presentada": la constancia ya existe.' : 'Esta etapa no admite retroceso.'
          const bad = validateReason(op.reason)
          if (bad) return bad
          const prev = FINDING_STAGES[stageIndex(f.stage) - 1]
          if (!prev) return 'Esta etapa no admite retroceso.'
          const cleared: Finding = {
            ...f,
            stage: prev,
            approval: f.stage === 'Aprobación interna' ? null : f.approval,
            packageGeneratedAt: f.stage === 'Paquete listo' ? null : f.packageGeneratedAt,
          }
          return note(s, cleared, `Etapa: ${f.stage} → ${prev} (retroceso). Motivo: ${op.reason.trim()}`)
        },
        'Retrocedió de etapa',
      )

    case 'close':
      return edit(
        s,
        op.id,
        (f) => {
          const wrong = needStage(f, 'En seguimiento')
          if (wrong) return wrong
          const blockers = advanceBlockers(f)
          if (blockers.length > 0) return blockers.join(' ')
          if (!filled(op.result)) return 'Indica el resultado del caso.'
          return note(s, { ...f, stage: 'Cerrado', closedAt: s.clock, closeResult: op.result.trim() }, `Caso cerrado: ${op.result.trim()}`)
        },
        'Cerró el caso',
      )
  }
}
