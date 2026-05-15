// Tipos específicos para queries do banco de dados

// Tipo base para queries genéricas
export interface BaseQueryResult {
    [key: string]: unknown
}

export interface ExpenseMonthlyResult {
    numero_mes: number
    total: string
}

export interface ExpenseStatsResult {
    total: string
    fixas: string
    transacoes: string
    media: string
}

export interface CategoryExpenseResult {
    id: number
    nome: string
    total: string
}

export interface CardResult {
    limite_disponivel: number
    dia_vencimento: number
    dias_fechamento_antes: number
}

export interface UserResult {
    id: number
    nome: string
    email: string
    senha?: string
    currency?: string
    created_at: Date
    updated_at: Date
}

export interface InvoicePaymentResult {
    id: number
    user_id: number
    card_id: number
    competencia_mes: number
    competencia_ano: number
    amount_paid: number
    created_at: Date
}

export interface ExpenseHistoryResult {
    id: number
    expense_id: number
    user_id: number
    tipo: string
    alteracao: Record<string, unknown>
    data_alteracao: Date
}

export interface MonthlyComparisonResult {
    receitas_atual: string
    receitas_anterior: string
    despesas_atual: string
    despesas_anterior: string
}

export interface DashboardStatsResult {
    saldo_atual: string
    saldo_futuro: string
    total_receitas_mes: string
    total_despesas_mes: string
}

// Tipos para agregações e estatísticas
export interface AggregationResult {
    count: string
    sum: string
    avg: string
    min: string
    max: string
}

// Tipos para queries de data/tempo
export interface DateRangeQuery {
    start_date: string
    end_date: string
}

export interface MonthYearQuery {
    month: number
    year: number
}

// Tipos para paginação
export interface PaginationQuery {
    page: number
    limit: number
    offset: number
}

// Tipos para ordenação
export interface SortQuery {
    sort_by: string
    sort_order: 'ASC' | 'DESC'
}

// Tipos básicos para queries simples
export interface CountResult {
    count: string
}

export interface ExistsResult {
    exists: boolean
}

export interface IdResult {
    id: number
}
