// Re-export tipos específicos do banco
export * from './database'

// ===== User Types =====
export interface User {
    id: number
    nome: string
    email: string
    senha?: string
    currency?: string
    created_at: Date
    updated_at: Date
}

export interface AuthUser {
    id: number
    email: string
}

// ===== Auth Types =====
export interface LoginRequest {
    email: string
    senha: string
}

export interface RegisterRequest {
    nome: string
    email: string
    senha: string
    inviteCode?: string
}

export interface AuthResponse {
    success?: boolean
    message: string
    user: Omit<User, 'senha'>
    token: string
}

// ===== Category Types =====
export interface Category {
    id: number
    nome: string
    cor: string
    tipo: 'despesa' | 'receita'
    parent_id?: number
    user_id: number
    created_at: Date
    updated_at: Date
}

export interface CreateCategoryRequest {
    nome: string
    cor: string
    tipo: 'despesa' | 'receita'
    parent_id?: number
}

// ===== Card Types =====
export interface Card {
    id: number
    nome: string
    tipo: 'crédito' | 'débito' | 'credito' | 'debito'
    numero: string
    cor: string
    limite: number
    limite_disponivel: number
    dia_vencimento?: number
    dias_fechamento_antes?: number
    user_id: number
    created_at: Date
    updated_at: Date
}

export interface CreateCardRequest {
    nome: string
    tipo: 'crédito' | 'débito' | 'credito' | 'debito'
    numero: string
    cor: string
    limite?: number
    dia_vencimento?: number
    dias_fechamento_antes?: number
}

// ===== Expense Types =====
export interface Expense {
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
    competencia_mes?: number
    competencia_ano?: number
    created_at: Date
    updated_at: Date
}

export interface CreateExpenseRequest {
    metodo_pagamento: string
    tipo: string
    quantidade: number
    fixo?: boolean
    data?: string
    parcelas?: number
    frequencia?: string
    card_id?: number
    category_id?: number
    observacoes?: string
}

// ===== Income Types =====
export interface Income {
    id: number
    tipo: string
    quantidade: number
    nota?: string
    data: string
    fonte?: string
    fixo: boolean
    user_id: number
    category_id?: number
    created_at: Date
    updated_at: Date
}

export interface CreateIncomeRequest {
    tipo: string
    quantidade: number
    nota?: string
    data?: string
    fonte?: string
    fixo?: boolean
    category_id?: number
}

// ===== Plan Types =====
export interface Plan {
    id: number
    nome: string
    descricao?: string
    meta: number
    total_contribuido: number
    prazo: string
    status: string
    user_id: number
    created_at: Date
    updated_at: Date
}

export interface CreatePlanRequest {
    nome: string
    descricao?: string
    meta: number
    prazo: string
}

export interface ContributionRequest {
    valor: number
}

// ===== Threshold Types =====
export interface Threshold {
    id: number
    user_id: number
    category_id: number
    valor: number
    created_at: Date
    updated_at: Date
}

export interface CreateThresholdRequest {
    category_id: number
    valor: number
}

// ===== Dashboard Types =====
export interface DashboardData {
    saldo: number
    saldoFuturo: number
    totaisMensais: MonthlyTotal[]
    resumoAnual: AnnualSummary[]
    comparativo: MonthlyComparison
    gastosPorCategoria: CategoryExpense[]
    topCategorias: TopCategory[]
    gastosPorCartao: CardExpense[]
    parcelasPendentes: PendingInstallment[]
    cartoesEstourados: OverlimitCard[]
    cartoesAVencer: DueCard[]
}

export interface MonthlyTotal {
    mes: number
    receitas: number
    despesas: number
}

export interface AnnualSummary {
    mes: string
    total_receitas: number
    total_despesas: number
}

export interface MonthlyComparison {
    receitas: {
        atual: number
        anterior: number
    }
    despesas: {
        atual: number
        anterior: number
    }
}

export interface CategoryExpense {
    id: number
    nome: string
    total: number
}

export interface TopCategory {
    nome: string
    total: number
}

export interface CardExpense {
    cartao: string
    total: number
}

export interface PendingInstallment {
    id: number
    tipo: string
    quantidade: number
    data: string
    parcelas: number
}

export interface OverlimitCard {
    id: number
    nome: string
    limite: number
}

export interface DueCard {
    id: number
    nome: string
    limite: number
    total_gasto: number
    dia_vencimento: number
}

// ===== API Response Types =====
export interface ApiResponse<T = unknown> {
    success: boolean
    data?: T
    message?: string
    error?: string
}

// ===== Error Types =====
export interface ApiError extends Error {
    status?: number
    code?: string
}
