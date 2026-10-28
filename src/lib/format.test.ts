import { describe, expect, it } from 'vitest'
import { formatNumber, plural } from './format'

describe('formato es-CL', () => {
  it('separa miles con punto', () => {
    expect(formatNumber(12480)).toBe('12.480')
    expect(formatNumber(999)).toBe('999')
    expect(formatNumber(1234567)).toBe('1.234.567')
  })
  it('pluraliza', () => {
    expect(plural(1, 'acuerdo vencido', 'acuerdos vencidos')).toBe('acuerdo vencido')
    expect(plural(0, 'acuerdo vencido', 'acuerdos vencidos')).toBe('acuerdos vencidos')
  })
})
