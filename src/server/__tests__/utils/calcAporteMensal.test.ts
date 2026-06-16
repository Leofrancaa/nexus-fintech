import { describe, it, expect } from 'vitest'
import {
  calcAporteMensal,
  taxaAnualParaMensal,
  mesesAtePrazo,
} from '@/server/utils/finance/calcAporteMensal'

describe('taxaAnualParaMensal', () => {
  it('converte taxa anual em mensal equivalente (juros compostos)', () => {
    // (1.10)^(1/12) - 1 ≈ 0.007974
    expect(taxaAnualParaMensal(10)).toBeCloseTo(0.007974, 5)
  })

  it('retorna 0 para taxa zero ou negativa', () => {
    expect(taxaAnualParaMensal(0)).toBe(0)
    expect(taxaAnualParaMensal(-5)).toBe(0)
  })
})

describe('mesesAtePrazo', () => {
  it('retorna 0 quando o prazo já passou', () => {
    expect(mesesAtePrazo('2000-01-01')).toBe(0)
  })

  it('calcula ~12 meses para um ano à frente', () => {
    const hoje = new Date('2025-01-01T12:00:00')
    const meses = mesesAtePrazo('2026-01-01', hoje)
    expect(meses).toBeGreaterThanOrEqual(12)
    expect(meses).toBeLessThanOrEqual(13)
  })
})

describe('calcAporteMensal', () => {
  it('retorna 0 quando a meta já foi atingida', () => {
    const r = calcAporteMensal({ meta: 1000, totalContribuido: 1000, mesesRestantes: 12, taxaAnual: 10 })
    expect(r.aporteMensal).toBe(0)
  })

  it('com taxa 0 faz divisão simples do que falta pelos meses', () => {
    const r = calcAporteMensal({ meta: 1200, totalContribuido: 0, mesesRestantes: 12, taxaAnual: 0 })
    expect(r.aporteMensal).toBe(100)
    expect(r.taxaMensal).toBe(0)
  })

  it('sem prazo restante exige o valor faltante de imediato', () => {
    const r = calcAporteMensal({ meta: 1000, totalContribuido: 200, mesesRestantes: 0, taxaAnual: 10 })
    expect(r.aporteMensal).toBe(800)
  })

  it('com juros, o aporte é menor do que a divisão simples', () => {
    const semJuros = calcAporteMensal({ meta: 12000, totalContribuido: 0, mesesRestantes: 12, taxaAnual: 0 })
    const comJuros = calcAporteMensal({ meta: 12000, totalContribuido: 0, mesesRestantes: 12, taxaAnual: 10 })
    expect(comJuros.aporteMensal).toBeLessThan(semJuros.aporteMensal)
    expect(comJuros.aporteMensal).toBeGreaterThan(0)
  })

  it('considera o crescimento do saldo já contribuído (PV rende juros)', () => {
    // Com saldo inicial alto e juros, o aporte cai bastante.
    const semSaldo = calcAporteMensal({ meta: 12000, totalContribuido: 0, mesesRestantes: 12, taxaAnual: 10 })
    const comSaldo = calcAporteMensal({ meta: 12000, totalContribuido: 6000, mesesRestantes: 12, taxaAnual: 10 })
    expect(comSaldo.aporteMensal).toBeLessThan(semSaldo.aporteMensal)
    expect(comSaldo.saldoProjetado).toBeGreaterThan(6000) // saldo rendeu
  })

  it('nunca retorna aporte negativo', () => {
    // saldo projetado já ultrapassa a meta → aporte 0, não negativo
    const r = calcAporteMensal({ meta: 10000, totalContribuido: 9900, mesesRestantes: 12, taxaAnual: 10 })
    expect(r.aporteMensal).toBeGreaterThanOrEqual(0)
  })

  it('lida com entradas inválidas sem quebrar', () => {
    const r = calcAporteMensal({ meta: NaN, totalContribuido: NaN, mesesRestantes: NaN, taxaAnual: NaN })
    expect(r.aporteMensal).toBe(0)
  })
})
