/**
 * Cálculo do aporte mensal necessário para atingir uma meta de investimento,
 * considerando juros compostos sobre o saldo já investido (fórmula PMT de
 * valor futuro de uma anuidade).
 *
 * Modelo:
 *   FV = PV·(1+i)^n + PMT · ((1+i)^n − 1) / i
 *   →  PMT = (FV − PV·(1+i)^n) / (((1+i)^n − 1) / i)
 *
 * onde:
 *   FV  = meta (valor futuro desejado)
 *   PV  = total já contribuído (rende juros até o prazo)
 *   i   = taxa mensal equivalente = (1 + taxaAnual/100)^(1/12) − 1
 *   n   = meses restantes até o prazo
 */

export interface AporteInput {
  meta: number
  totalContribuido: number
  mesesRestantes: number
  /** Taxa anual em % a.a. (ex.: 10.5). */
  taxaAnual: number
}

export interface AporteResult {
  /** Aporte mensal necessário (R$), nunca negativo. */
  aporteMensal: number
  /** Taxa mensal equivalente usada (fração, ex.: 0.0083). */
  taxaMensal: number
  /** Projeção do valor futuro do saldo atual sem novos aportes. */
  saldoProjetado: number
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/**
 * Converte taxa anual (% a.a.) para taxa mensal equivalente (fração).
 */
export function taxaAnualParaMensal(taxaAnual: number): number {
  if (!Number.isFinite(taxaAnual) || taxaAnual <= 0) return 0
  return Math.pow(1 + taxaAnual / 100, 1 / 12) - 1
}

/**
 * Calcula o número de meses entre hoje e a data de prazo (YYYY-MM-DD ou Date).
 * Arredonda para cima; nunca negativo.
 */
export function mesesAtePrazo(prazo: string | Date, hoje: Date = new Date()): number {
  const prazoDate =
    prazo instanceof Date ? prazo : new Date(`${String(prazo).split('T')[0]}T23:59:59`)

  if (Number.isNaN(prazoDate.getTime())) return 0

  const diffMs = prazoDate.getTime() - hoje.getTime()
  if (diffMs <= 0) return 0

  const diffDias = diffMs / (1000 * 60 * 60 * 24)
  return Math.max(0, Math.ceil(diffDias / (365.25 / 12)))
}

export function calcAporteMensal({
  meta,
  totalContribuido,
  mesesRestantes,
  taxaAnual,
}: AporteInput): AporteResult {
  const fv = Number.isFinite(meta) ? Math.max(0, meta) : 0
  const pv = Number.isFinite(totalContribuido) ? Math.max(0, totalContribuido) : 0
  const n = Number.isFinite(mesesRestantes) ? Math.max(0, Math.floor(mesesRestantes)) : 0
  const i = taxaAnualParaMensal(taxaAnual)

  // Meta já atingida → não precisa aportar.
  if (pv >= fv) {
    return { aporteMensal: 0, taxaMensal: i, saldoProjetado: round2(pv) }
  }

  // Sem prazo restante → precisa do valor faltante de imediato.
  if (n <= 0) {
    return { aporteMensal: round2(fv - pv), taxaMensal: i, saldoProjetado: round2(pv) }
  }

  // Sem juros → divisão simples do que falta pelos meses.
  if (i <= 0) {
    return {
      aporteMensal: round2((fv - pv) / n),
      taxaMensal: 0,
      saldoProjetado: round2(pv),
    }
  }

  const fator = Math.pow(1 + i, n)
  const saldoProjetado = pv * fator
  const fatorAnuidade = (fator - 1) / i
  const aporte = (fv - saldoProjetado) / fatorAnuidade

  return {
    aporteMensal: round2(Math.max(0, aporte)),
    taxaMensal: i,
    saldoProjetado: round2(saldoProjetado),
  }
}
