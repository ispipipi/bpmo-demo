import { screening, type Screening } from './derive/sla'
import { nextId } from './ids'
import { withLog } from './log'
import { err, ok, type Result } from './result'
import type { Answer, DemoState, Project, ScreeningAnswers } from './types'

const ACTOR = 'Analista PMO'
export const QUESTIONS = [
  '¿Incorpora nuevas actividades de tratamiento (RAT)?',
  '¿Requiere nuevo consentimiento?',
  '¿Implica transferencia internacional de datos?',
  '¿Trata datos sensibles?',
  '¿Involucra a un proveedor nuevo?',
] as const

export const BLANK: ScreeningAnswers = [null, null, null, null, null]

export type ProjectOp =
  | { kind: 'register'; name: string; lead: string; answers: ScreeningAnswers }
  | { kind: 'evaluate'; id: string; answers: ScreeningAnswers }
  | { kind: 'sign'; id: string; date: string; ref: string }

export type ProjectErrors = Partial<Record<'name' | 'lead' | 'answers', string>>
export function validateProject(p: { name: string; lead: string; answers: readonly Answer[] }, needsIdentity = true): ProjectErrors {
  const e: ProjectErrors = {}
  if (needsIdentity && p.name.trim() === '') e.name = 'Indica el nombre del proyecto.'
  if (needsIdentity && p.lead.trim() === '') e.lead = 'Indica el jefe de proyecto.'
  if (p.answers.some((a) => a === null)) e.answers = 'Responde las 5 preguntas para guardar la evaluación.'
  return e
}

export type RiskLabel = 'Sin evaluar' | 'Alto' | 'Medio' | 'Bajo'
export function projectView(p: Project): { risk: RiskLabel; screening: Screening | null } {
  const sc = p.evaluatedAt ? screening(p.answers) : null
  return { risk: sc ? sc.risk : 'Sin evaluar', screening: sc }
}

export const yesCount = (a: readonly Answer[]): number => a.filter((x) => x === true).length

const sameAnswers = (a: readonly Answer[], b: readonly Answer[]) => a.every((x, i) => x === b[i])

function edit(s: DemoState, id: string, change: (p: Project) => Project | string, log: string): Result<DemoState, string> {
  const p = s.data.projects.find((x) => x.id === id)
  if (!p) return err(`No existe el proyecto ${id}.`)
  const next = change(p)
  if (typeof next === 'string') return err(next)
  return ok(withLog({ ...s, data: { ...s.data, projects: s.data.projects.map((x) => (x.id === id ? next : x)) } }, log, id))
}

export function applyProjectOp(s: DemoState, op: ProjectOp): Result<DemoState, string> {
  switch (op.kind) {
    case 'register': {
      const bad = Object.values(validateProject(op))[0]
      if (bad) return err(bad)
      const id = nextId('PRY', s.data.projects.map((p) => p.id), 3)
      const sc = screening(op.answers)
      const p: Project = {
        id,
        name: op.name.trim(),
        lead: op.lead.trim(),
        answers: op.answers,
        evaluatedAt: s.clock,
        checklistRef: null,
        checklistSignedAt: null,
        history: [{ date: s.clock, actor: ACTOR, text: `Proyecto registrado y evaluado: riesgo ${sc?.risk}, ${sc?.requiresEipd ? 'requiere EIPD' : 'no requiere EIPD'}` }],
      }
      return ok(withLog({ ...s, data: { ...s.data, projects: [...s.data.projects, p] } }, `Registró el proyecto ${p.name}`, id))
    }
    case 'evaluate':
      return edit(
        s,
        op.id,
        (p) => {
          const bad = Object.values(validateProject({ name: p.name, lead: p.lead, answers: op.answers }, false))[0]
          if (bad) return bad
          const before = projectView(p)
          const changed = !sameAnswers(p.answers, op.answers)
          const next: Project = { ...p, answers: op.answers, evaluatedAt: s.clock, ...(changed ? { checklistRef: null, checklistSignedAt: null } : {}) }
          const after = projectView(next)
          const text = before.screening ? `Reevaluado: riesgo ${before.risk} → ${after.risk}${changed && p.checklistSignedAt ? '. El checklist firmado anterior ya no aplica' : ''}` : `Evaluado: riesgo ${after.risk}, ${after.screening?.requiresEipd ? 'requiere EIPD' : 'no requiere EIPD'}`
          return { ...next, history: [...p.history, { date: s.clock, actor: ACTOR, text }] }
        },
        'Evaluó el proyecto',
      )
    case 'sign':
      return edit(
        s,
        op.id,
        (p) => {
          if (!p.evaluatedAt) return 'Evalúa el proyecto antes de registrar el checklist firmado.'
          if (!/^\d{4}-\d{2}-\d{2}$/.test(op.date) || op.date > s.clock) return 'Ingresa una fecha válida, no posterior a la fecha de demo.'
          if (op.ref.trim() === '') return 'Indica la referencia.'
          return { ...p, checklistRef: op.ref.trim(), checklistSignedAt: op.date, history: [...p.history, { date: s.clock, actor: ACTOR, text: `Checklist firmado registrado (${op.ref.trim()})` }] }
        },
        'Registró el checklist firmado',
      )
  }
}
