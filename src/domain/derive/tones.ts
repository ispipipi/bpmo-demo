import { CATALOG, CATEGORIES, isIncluded, type Category, type ProcessId } from '../catalog'
import { daysLeft } from './sla'
import { worstTone, type Tone } from '../tone'
import type { DemoState } from '../types'
import {
  arcopTone,
  consentTone,
  isArcopOpen,
  isEvaluated,
  isRatRequestOpen,
  ratRequestTone,
  ratReviewTone,
  vendorTone,
} from './sla'
import { isFindingOpen } from './mpi'

/** Estado derivado de cada proceso incluido (MD §6.0). Se calcula; no se guarda. */
export function processTone(pid: ProcessId, s: DemoState): Tone {
  const { data } = s
  switch (pid) {
    case 'P1': {
      const tones = data.arcop.filter(isArcopOpen).map((r) => arcopTone(r, s))
      return tones.includes('crit') ? 'crit' : tones.includes('warn') ? 'warn' : 'ok'
    }
    case 'P20': {
      const states = data.mpi.items.map((i) => i.state)
      if (states.includes('No cumple')) return 'crit'
      if (states.includes('En progreso') || data.mpi.status !== 'Vigente') return 'warn'
      return 'ok'
    }
    case 'P19': {
      const open = data.findings.filter(isFindingOpen)
      if (open.some((f) => f.severity === 'Alta')) return 'crit'
      return open.length > 0 ? 'warn' : 'ok'
    }
    case 'P11':
      return data.projects.some((p) => !isEvaluated(p)) ? 'warn' : 'ok'
    case 'P6b': {
      const tones = [...data.rat.requests.filter(isRatRequestOpen).map((r) => ratRequestTone(r, s)), ratReviewTone(s)]
      return tones.includes('crit') ? 'crit' : tones.includes('warn') ? 'warn' : 'ok'
    }
    case 'P8':
      return data.consents.some((c) => consentTone(c, s) === 'warn') ? 'warn' : 'ok'
    case 'P17':
    case 'P10':
      return worstTone(data.vendors.map((v) => vendorTone(v, s)))
    case 'P9': {
      const open = data.committee.agreements.filter((a) => a.status === 'Pendiente')
      if (open.some((a) => a.dueAt < s.clock)) return 'crit'
      return committeeNoticeActive(s) ? 'warn' : 'ok'
    }
    case 'P4':
      return 'info'
    default:
      return 'na'
  }
}

export function nextSession(s: DemoState) {
  return s.data.committee.sessions
    .filter((x) => x.status === 'Próxima' && x.date >= s.clock)
    .sort((a, b) => a.date.localeCompare(b.date))[0]
}

/** Próxima sesión dentro del aviso del parámetro (MD §6.0, P9 amarillo). */
export function committeeNoticeActive(s: DemoState): boolean {
  const next = nextSession(s)
  return next !== undefined && daysLeft(next.date, s.clock) <= s.params.committeeNoticeDays
}

/** El semáforo de la categoría es el peor de sus procesos incluidos (AC-22). Sin incluidos: 'na'. */
export function categoryTone(category: Category, s: DemoState): Tone {
  return worstTone(CATALOG.filter((p) => p.category === category && isIncluded(p)).map((p) => processTone(p.id, s)))
}

export const allCategoryTones = (s: DemoState): Record<Category, Tone> =>
  Object.fromEntries(CATEGORIES.map((c) => [c, categoryTone(c, s)])) as Record<Category, Tone>

export type ProcessStatus = { tone: Tone; label: string }

/** Semáforo + etiqueta contextual de cada proceso (Mapa, fichas, Dashboard). La etiqueta nunca reemplaza al icono de la forma. */
export function processStatus(pid: ProcessId, s: DemoState): ProcessStatus {
  const tone = processTone(pid, s)
  const { data, clock } = s
  const label = ((): string => {
    switch (pid) {
      case 'P1':
        return { crit: 'Vencido', warn: 'Por vencer', ok: 'En plazo' }[tone as 'crit' | 'warn' | 'ok']
      case 'P20': {
        if (tone === 'crit') return 'Ítems que no cumplen'
        if (tone === 'ok') return 'Vigente'
        return data.mpi.items.some((i) => i.state === 'En progreso') ? 'En progreso' : data.mpi.status
      }
      case 'P19':
        return tone === 'crit' ? 'Caso crítico abierto' : tone === 'warn' ? 'Caso abierto' : 'Sin casos abiertos'
      case 'P11':
        return tone === 'warn' ? 'Sin evaluar' : 'Evaluados'
      case 'P6b': {
        const late = data.rat.requests.some((r) => isRatRequestOpen(r) && ratRequestTone(r, s) === 'crit')
        if (tone === 'crit') return late ? 'Fuera de plazo' : 'Revisión vencida'
        return tone === 'warn' ? 'Por vencer' : 'En plazo'
      }
      case 'P8':
        return tone === 'warn' ? 'Por validar' : 'Vigente'
      case 'P17':
      case 'P10': {
        if (tone === 'ok') return 'Vigente'
        if (tone === 'warn') return 'Por vencer'
        if (data.vendors.some((v) => v.dpa !== 'Vigente')) return 'Sin DPA'
        if (pid === 'P17' && data.vendors.some((v) => v.international && v.guarantee === null)) return 'Sin garantía'
        return 'Contrato vencido'
      }
      case 'P9': {
        const overdue = data.committee.agreements.filter((a) => a.status === 'Pendiente' && a.dueAt < clock).length
        if (tone === 'crit') return overdue === 1 ? '1 acuerdo vencido' : `${overdue} acuerdos vencidos`
        return tone === 'warn' ? 'Próximo comité' : 'En orden'
      }
      case 'P4':
        return 'Informativo'
      default:
        return 'No incluido'
    }
  })()
  return { tone, label }
}

export type CategoryStatus = { tone: Tone; label: string }

export function categoryStatus(category: Category, s: DemoState): CategoryStatus {
  const tone = categoryTone(category, s)
  const label = ((): string => {
    switch (tone) {
      case 'crit':
        return category === 'Terceros' ? 'Crítico' : 'Vencido'
      case 'warn':
        return category === 'Gestión de riesgo y proyectos' ? 'Por completar' : 'Por vencer'
      case 'ok':
        return 'En plazo'
      case 'info':
        return 'Informativo'
      case 'na':
        return 'Sin procesos incluidos'
    }
  })()
  return { tone, label }
}
