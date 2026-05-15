import { describe, it, expect } from 'vitest'
import {
  normalize,
  addMonthsSafe,
  formatDate,
  formatDateFromDB,
  isValidEmail,
  isPositiveNumber,
  toNumber,
  isValidHexColor,
  calculateCompetencia,
} from '@/server/utils/helper'

describe('normalize', () => {
  it('remove acentos e converte para lowercase', () => {
    expect(normalize('Açaí')).toBe('acai')
    expect(normalize('São Paulo')).toBe('sao paulo')
    expect(normalize('CRÉDITO')).toBe('credito')
    expect(normalize('débito')).toBe('debito')
  })

  it('remove espaços nas extremidades', () => {
    expect(normalize('  texto  ')).toBe('texto')
  })

  it('retorna string vazia quando recebe vazio', () => {
    expect(normalize('')).toBe('')
  })

  it('lida com undefined (padrão vazio)', () => {
    expect(normalize(undefined as unknown as string)).toBe('')
  })
})

describe('addMonthsSafe', () => {
  it('adiciona meses normalmente', () => {
    const jan15 = new Date(2025, 0, 15) // 15 Jan 2025
    const result = addMonthsSafe(jan15, 1)
    expect(result.getMonth()).toBe(1) // Fevereiro
    expect(result.getDate()).toBe(15)
  })

  it('trata final de mês — 31 Jan + 1 mês = 28 Fev (ano não bissexto)', () => {
    const jan31 = new Date(2025, 0, 31)
    const result = addMonthsSafe(jan31, 1)
    expect(result.getMonth()).toBe(1) // Fevereiro
    expect(result.getDate()).toBe(28)
  })

  it('trata final de mês — 31 Jan + 1 mês = 29 Fev (ano bissexto)', () => {
    const jan31 = new Date(2024, 0, 31)
    const result = addMonthsSafe(jan31, 1)
    expect(result.getMonth()).toBe(1) // Fevereiro
    expect(result.getDate()).toBe(29)
  })

  it('adiciona vários meses', () => {
    const mar15 = new Date(2025, 2, 15) // 15 Mar
    const result = addMonthsSafe(mar15, 3)
    expect(result.getMonth()).toBe(5) // Junho
    expect(result.getDate()).toBe(15)
  })

  it('não muta a data original', () => {
    const original = new Date(2025, 0, 15)
    const copia = new Date(original)
    addMonthsSafe(original, 2)
    expect(original.getTime()).toBe(copia.getTime())
  })
})

describe('formatDate', () => {
  it('formata data para YYYY-MM-DD', () => {
    const data = new Date('2025-03-15T12:00:00Z')
    expect(formatDate(data)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('retorna o formato correto para data conhecida', () => {
    // Usa UTC para evitar problemas de fuso horário
    const data = new Date('2025-01-05T12:00:00Z')
    const resultado = formatDate(data)
    expect(resultado).toMatch(/^2025-01-/)
  })
})

describe('formatDateFromDB', () => {
  it('retorna vazio para null', () => {
    expect(formatDateFromDB(null)).toBe('')
  })

  it('trata string com T — retorna apenas a parte da data', () => {
    expect(formatDateFromDB('2025-03-15T12:00:00.000Z')).toBe('2025-03-15')
  })

  it('trata string sem T — retorna intacta', () => {
    expect(formatDateFromDB('2025-03-15')).toBe('2025-03-15')
  })

  it('trata string com espaço (formato SQL)', () => {
    expect(formatDateFromDB('2025-03-15 12:00:00')).toBe('2025-03-15')
  })

  it('trata objeto Date', () => {
    const d = new Date('2025-05-10T12:00:00Z')
    const resultado = formatDateFromDB(d)
    expect(resultado).toMatch(/^2025-05-/)
  })
})

describe('isValidEmail', () => {
  it('aceita emails válidos', () => {
    expect(isValidEmail('usuario@exemplo.com')).toBe(true)
    expect(isValidEmail('teste.nome+tag@dominio.org')).toBe(true)
    expect(isValidEmail('a@b.co')).toBe(true)
  })

  it('rejeita emails inválidos', () => {
    expect(isValidEmail('semArroba.com')).toBe(false)
    expect(isValidEmail('@semUsuario.com')).toBe(false)
    expect(isValidEmail('usuario@')).toBe(false)
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('usuario@dominio')).toBe(false)
  })
})

describe('isPositiveNumber', () => {
  it('aceita números positivos', () => {
    expect(isPositiveNumber(1)).toBe(true)
    expect(isPositiveNumber(100)).toBe(true)
    expect(isPositiveNumber(0.01)).toBe(true)
  })

  it('rejeita zero', () => {
    expect(isPositiveNumber(0)).toBe(false)
  })

  it('rejeita negativos', () => {
    expect(isPositiveNumber(-1)).toBe(false)
    expect(isPositiveNumber(-100)).toBe(false)
  })

  it('rejeita strings', () => {
    expect(isPositiveNumber('100')).toBe(false)
  })

  it('rejeita null e undefined', () => {
    expect(isPositiveNumber(null)).toBe(false)
    expect(isPositiveNumber(undefined)).toBe(false)
  })
})

describe('toNumber', () => {
  it('converte number para number', () => {
    expect(toNumber(42)).toBe(42)
    expect(toNumber(3.14)).toBe(3.14)
  })

  it('converte string numérica para número', () => {
    expect(toNumber('100')).toBe(100)
    expect(toNumber('3.14')).toBe(3.14)
  })

  it('retorna null para string não numérica', () => {
    expect(toNumber('abc')).toBeNull()
    expect(toNumber('')).toBeNull()
    expect(toNumber('12abc')).toBeNull()
  })

  it('retorna null para null e undefined', () => {
    expect(toNumber(null)).toBeNull()
    expect(toNumber(undefined)).toBeNull()
  })

  it('retorna null para boolean', () => {
    expect(toNumber(true)).toBeNull()
    expect(toNumber(false)).toBeNull()
  })
})

describe('isValidHexColor', () => {
  it('aceita #RRGGBB', () => {
    expect(isValidHexColor('#FF5733')).toBe(true)
    expect(isValidHexColor('#000000')).toBe(true)
    expect(isValidHexColor('#FFFFFF')).toBe(true)
    expect(isValidHexColor('#abc123')).toBe(true)
  })

  it('aceita #RGB (3 dígitos)', () => {
    expect(isValidHexColor('#FFF')).toBe(true)
    expect(isValidHexColor('#123')).toBe(true)
    expect(isValidHexColor('#abc')).toBe(true)
  })

  it('rejeita formatos inválidos', () => {
    expect(isValidHexColor('FF5733')).toBe(false)   // sem #
    expect(isValidHexColor('#FF573')).toBe(false)   // 5 dígitos
    expect(isValidHexColor('#GG0000')).toBe(false)  // caractere inválido
    expect(isValidHexColor('')).toBe(false)
    expect(isValidHexColor('#FFFFFFFF')).toBe(false) // 8 dígitos
  })
})

describe('calculateCompetencia', () => {
  /*
   * Lógica de competência do cartão brasileiro:
   * - A fatura "fecha" N dias antes do vencimento (closeDaysBefore)
   * - Compras ANTES do fechamento → pertencem à fatura que fecha nesse mês
   *   (nomeada pelo mês anterior ao vencimento)
   * - Compras APÓS o fechamento → pertencem à fatura seguinte
   *
   * Exemplo: vencimento dia 10, fechamento 5 dias antes = dia 5
   * - Compra dia 3 jan → antes do fechamento (jan 5) → fatura de dez/2024
   *   (essa fatura cobre compras de dez/5 a jan/5, vence jan/10)
   * - Compra dia 7 jan → após o fechamento (jan 5) → fatura de jan/2025
   *   (essa fatura cobre compras de jan/5 a fev/5, vence fev/10)
   */

  it('compra 3 jan antes do fechamento dia 5: competência dezembro do ano anterior', () => {
    const purchaseDate = new Date(2025, 0, 3) // 3 Jan 2025
    const result = calculateCompetencia(purchaseDate, 10, 5)
    expect(result.competencia_mes).toBe(12) // Dezembro 2024
    expect(result.competencia_ano).toBe(2024)
  })

  it('compra 7 jan após o fechamento dia 5: competência janeiro', () => {
    const purchaseDate = new Date(2025, 0, 7) // 7 Jan 2025
    const result = calculateCompetencia(purchaseDate, 10, 5)
    expect(result.competencia_mes).toBe(1) // Janeiro 2025
    expect(result.competencia_ano).toBe(2025)
  })

  it('compra exatamente no dia do fechamento (dia 5): competência do mês atual', () => {
    // >= closeDate → vai para o mês atual
    const purchaseDate = new Date(2025, 0, 5) // 5 Jan 2025
    const result = calculateCompetencia(purchaseDate, 10, 5)
    expect(result.competencia_mes).toBe(1) // Janeiro 2025
    expect(result.competencia_ano).toBe(2025)
  })

  it('dueDay=1, closeDaysBefore=10: compra 25 dez vai para competência janeiro do próximo ano', () => {
    // Fechamento = dia 22 de cada mês (1 - 10 + 31 = 22)
    // Compra 25 Dez → após fechamento (22 Dez) → fatura de jan/2026
    const purchaseDate = new Date(2025, 11, 25) // 25 Dez 2025
    const result = calculateCompetencia(purchaseDate, 1, 10)
    expect(result.competencia_mes).toBe(1) // Janeiro 2026
    expect(result.competencia_ano).toBe(2026)
  })

  it('dueDay=1, closeDaysBefore=10: compra 15 nov antes do fechamento: competência outubro', () => {
    // Fechamento = dia 22 de novembro (1 do mês seguinte - 10 dias)
    // Compra 15 Nov → antes do fechamento (22 Nov) → fatura que fecha 22 Nov, vence 1 Dez
    // Competência = Nov (addMonthsSafe(Dec 1, -1) = Nov 1) → mês 11
    const purchaseDate = new Date(2025, 10, 15) // 15 Nov 2025
    const result = calculateCompetencia(purchaseDate, 1, 10)
    expect(result.competencia_mes).toBe(11) // Novembro 2025
    expect(result.competencia_ano).toBe(2025)
  })

  it('dueDay=15, closeDaysBefore=10: compra 3 mar antes do fechamento: competência fevereiro', () => {
    // Fechamento = dia 5 de março (15 - 10)
    // Compra 3 Mar → antes do fechamento (5 Mar) → fatura que fecha 5 Mar, vence 15 Mar
    // Competência = Feb (addMonthsSafe(Mar 15, -1) = Fev 15) → mês 2
    const purchaseDate = new Date(2025, 2, 3) // 3 Mar 2025
    const result = calculateCompetencia(purchaseDate, 15, 10)
    expect(result.competencia_mes).toBe(2) // Fevereiro 2025
    expect(result.competencia_ano).toBe(2025)
  })

  it('compra 20 dez com vencimento dia 10: competência dezembro (entre vencimentos)', () => {
    // nextDue = Jan 10, 2026 (pois Dez 20 > Dez 10)
    // closeDate = Jan 5, 2026
    // Dez 20 < Jan 5 → competencia = addMonthsSafe(Jan 10, -1) = Dez 10 → mês 12
    const purchaseDate = new Date(2025, 11, 20) // 20 Dez 2025
    const result = calculateCompetencia(purchaseDate, 10, 5)
    expect(result.competencia_mes).toBe(12) // Dezembro 2025
    expect(result.competencia_ano).toBe(2025)
  })
})
