// src/server/types/finance.ts
export interface SaldoResult {
    saldo: number
}

export interface TotaisMensaisResult {
    receitas: Array<{ mes: number; total: number }>
    despesas: Array<{ mes: number; total: number }>
}

export interface ComparativoMensalResult {
    receitas: {
        atual: number
        anterior: number
    }
    despesas: {
        atual: number
        anterior: number
    }
}

export interface GastosPorCategoriaResult {
    id: number
    nome: string
    total: number
}

export interface GastosPorCartaoResult {
    cartao: string
    total: number
}

export interface TopCategoriasResult {
    nome: string
    total: number
}

export interface CartoesEstouradosResult {
    id: number
    nome: string
    limite: number
}

export interface CartoesAVencerResult {
    id: number
    nome: string
    limite: number
    total_gasto: number
    dia_vencimento: number
}

export interface ParcelasPendentesResult {
    id: number
    metodo_pagamento: string
    tipo: string
    quantidade: number
    data: string
    parcelas: number
}

export interface ResumoAnualResult {
    mes: string
    total_receitas: number
    total_despesas: number
}

export interface ReceitasDoMesResult {
    id: number
    tipo: string
    quantidade: number
    nota?: string
    data: string
    fonte?: string
    user_id: number
    category_id?: number
    created_at: Date
    updated_at: Date
}

export interface DespesasDoMesResult {
    id: number
    metodo_pagamento: string
    tipo: string
    quantidade: number
    fixo: boolean
    data: string
    parcelas?: number
    frequencia?: string
    user_id: number
    card_id?: number
    category_id?: number
    observacoes?: string
    created_at: Date
    updated_at: Date
}
