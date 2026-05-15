import { ApiError, ApiResponse } from '@/server/types/index'

/**
 * Normaliza string removendo acentos e convertendo para lowercase
 */
export const normalize = (str: string = ""): string => {
    return String(str)
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim()
}

/**
 * Adiciona meses a uma data de forma segura (lida com diferentes números de dias no mês)
 */
export const addMonthsSafe = (date: Date, months: number): Date => {
    const newDate = new Date(date)
    const day = newDate.getDate()

    newDate.setMonth(newDate.getMonth() + months)

    if (newDate.getDate() < day) {
        newDate.setDate(0)
    }

    return newDate
}

/**
 * Formata data para string YYYY-MM-DD
 */
export const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0]
}

/**
 * Formata uma data retornada do banco (timestamp ou string) para YYYY-MM-DD
 */
export const formatDateFromDB = (dateValue: string | Date | null): string => {
    if (!dateValue) return ''

    if (typeof dateValue === 'string') {
        return dateValue.split('T')[0].split(' ')[0]
    }

    return formatDate(dateValue)
}

/**
 * Formata todas as datas de um objeto do banco
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const formatDatesInObject = <T = any>(obj: T): T => {
    const formatted: Record<string, unknown> = { ...(obj as Record<string, unknown>) }

    const dateFields = ['data', 'prazo', 'created_at', 'updated_at']

    for (const field of dateFields) {
        if (formatted[field]) {
            formatted[field] = formatDateFromDB(formatted[field] as string | Date)
        }
    }

    return formatted as T
}

/**
 * Valida se uma string é um email válido
 */
export const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

/**
 * Valida se um número é positivo
 */
export const isPositiveNumber = (value: unknown): boolean => {
    return typeof value === 'number' && value > 0
}

/**
 * Converte string para número, retorna null se inválido
 */
export const toNumber = (value: unknown): number | null => {
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
        if (value.trim() === '') return null
        const num = Number(value)
        return isNaN(num) ? null : num
    }
    return null
}

/**
 * Valida se uma cor está no formato hexadecimal
 */
export const isValidHexColor = (color: string): boolean => {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)
}

/**
 * Gera uma resposta de erro padronizada
 */
export const createErrorResponse = (
    message: string,
    status: number = 500,
    details?: unknown
): ApiError => {
    const error = new Error(message) as ApiError
    error.status = status
    if (details) error.code = String(details)
    return error
}

/**
 * Gera uma resposta de sucesso padronizada
 */
export const createSuccessResponse = <T>(
    data: T,
    message?: string
): ApiResponse<T> => {
    return {
        success: true,
        data,
        message: message ?? ''
    }
}

/**
 * Extrai mensagem segura para o usuário a partir de um erro.
 */
export const resolveUserMessage = (error: unknown, fallback: string): string => {
    const apiError = error as ApiError
    if (apiError?.status && apiError?.message) return apiError.message
    return fallback
}

/**
 * Calcula a competência da fatura baseada na data de compra
 */
export const calculateCompetencia = (
    purchaseDate: Date,
    dueDay: number,
    closeDaysBefore: number = 10
): { competencia_mes: number; competencia_ano: number } => {
    const year = purchaseDate.getFullYear()
    const month = purchaseDate.getMonth()

    const thisMonthDue = new Date(year, month, Math.min(dueDay, 28))

    const nextDue = purchaseDate <= thisMonthDue
        ? thisMonthDue
        : new Date(year, month + 1, Math.min(dueDay, 28))

    const closeDate = new Date(nextDue)
    closeDate.setDate(closeDate.getDate() - closeDaysBefore)

    const competenciaDate = purchaseDate >= closeDate
        ? nextDue
        : addMonthsSafe(nextDue, -1)

    return {
        competencia_mes: competenciaDate.getMonth() + 1,
        competencia_ano: competenciaDate.getFullYear()
    }
}

/**
 * Valida se uma data está no formato YYYY-MM-DD
 */
export const isValidDateString = (dateString: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false

    const date = new Date(dateString + 'T00:00:00')
    return date instanceof Date && !isNaN(date.getTime())
}

/**
 * Retorna o último dia do mês para uma data específica
 */
export const getLastDayOfMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

/**
 * Formata valor monetário para exibição
 */
export const formatCurrency = (value: number, currency: string = 'BRL'): string => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: currency
    }).format(value)
}

/**
 * Sanitiza string removendo caracteres especiais perigosos
 */
export const sanitizeString = (str: string): string => {
    return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/[<>]/g, '')
        .trim()
}

/**
 * Gera ID único simples (para uso em desenvolvimento/testes)
 */
export const generateId = (): string => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

/**
 * Delay assíncrono (útil para testes e rate limiting)
 */
export const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Verifica se o ambiente é de desenvolvimento
 */
export const isDevelopment = (): boolean => {
    return process.env.NODE_ENV === 'development'
}

/**
 * Verifica se o ambiente é de produção
 */
export const isProduction = (): boolean => {
    return process.env.NODE_ENV === 'production'
}
