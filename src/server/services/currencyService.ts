import prisma from '@/server/db/prisma'
import { createErrorResponse } from '@/server/utils/helper'

type SupportedCurrency = 'BRL' | 'USD' | 'EUR' | 'GBP'

interface CurrencyInfo {
    code: SupportedCurrency
    name: string
    symbol: string
    decimal_places: number
    is_default: boolean
}

export class CurrencyService {
    private static readonly SUPPORTED_CURRENCIES: CurrencyInfo[] = [
        { code: 'BRL', name: 'Real Brasileiro', symbol: 'R$', decimal_places: 2, is_default: true },
        { code: 'USD', name: 'Dólar Americano', symbol: '$', decimal_places: 2, is_default: false },
        { code: 'EUR', name: 'Euro', symbol: '€', decimal_places: 2, is_default: false },
        { code: 'GBP', name: 'Libra Esterlina', symbol: '£', decimal_places: 2, is_default: false },
    ]

    static async updateUserCurrency(
        userId: number,
        currency: SupportedCurrency
    ): Promise<{ message: string; currency: SupportedCurrency }> {
        const isSupported = this.SUPPORTED_CURRENCIES.some(c => c.code === currency)
        if (!isSupported) {
            throw createErrorResponse(
                `Moeda '${currency}' não suportada. Moedas disponíveis: ${this.SUPPORTED_CURRENCIES.map(c => c.code).join(', ')}`,
                400
            )
        }

        await prisma.user.update({
            where: { id: userId },
            data: { currency }
        })

        return {
            message: `Moeda atualizada para ${currency} com sucesso.`,
            currency
        }
    }

    static async getUserCurrency(userId: number): Promise<{
        currency: SupportedCurrency
        currency_info: CurrencyInfo
    }> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { currency: true }
        })

        const userCurrency = ((user?.currency) || 'BRL') as SupportedCurrency
        const currencyInfo = this.SUPPORTED_CURRENCIES.find(c => c.code === userCurrency) || this.SUPPORTED_CURRENCIES[0]

        return { currency: userCurrency, currency_info: currencyInfo }
    }

    static getSupportedCurrencies(): CurrencyInfo[] {
        return [...this.SUPPORTED_CURRENCIES]
    }

    static getCurrencyInfo(currency: SupportedCurrency): CurrencyInfo | null {
        return this.SUPPORTED_CURRENCIES.find(c => c.code === currency) || null
    }

    static formatCurrency(
        value: number,
        currency: SupportedCurrency,
        locale: string = 'pt-BR'
    ): string {
        const currencyInfo = this.getCurrencyInfo(currency)
        if (!currencyInfo) return value.toString()

        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currency,
                minimumFractionDigits: currencyInfo.decimal_places,
                maximumFractionDigits: currencyInfo.decimal_places
            }).format(value)
        } catch {
            return `${currencyInfo.symbol} ${value.toFixed(currencyInfo.decimal_places)}`
        }
    }

    static async convertCurrency(
        amount: number,
        fromCurrency: SupportedCurrency,
        toCurrency: SupportedCurrency
    ): Promise<{
        original_amount: number
        original_currency: SupportedCurrency
        converted_amount: number
        converted_currency: SupportedCurrency
        exchange_rate: number
        conversion_date: string
    }> {
        if (fromCurrency === toCurrency) {
            return {
                original_amount: amount,
                original_currency: fromCurrency,
                converted_amount: amount,
                converted_currency: toCurrency,
                exchange_rate: 1,
                conversion_date: new Date().toISOString()
            }
        }

        const exchangeRates: Record<string, number> = {
            'BRL-USD': 0.20, 'USD-BRL': 5.00,
            'BRL-EUR': 0.18, 'EUR-BRL': 5.55,
            'BRL-GBP': 0.16, 'GBP-BRL': 6.25,
            'USD-EUR': 0.92, 'EUR-USD': 1.09,
            'USD-GBP': 0.82, 'GBP-USD': 1.22,
            'EUR-GBP': 0.86, 'GBP-EUR': 1.16,
        }

        const rateKey = `${fromCurrency}-${toCurrency}`
        const exchangeRate = exchangeRates[rateKey]

        if (!exchangeRate) {
            throw createErrorResponse(
                `Taxa de câmbio não disponível para conversão de ${fromCurrency} para ${toCurrency}`,
                400
            )
        }

        return {
            original_amount: amount,
            original_currency: fromCurrency,
            converted_amount: Math.round(amount * exchangeRate * 100) / 100,
            converted_currency: toCurrency,
            exchange_rate: exchangeRate,
            conversion_date: new Date().toISOString()
        }
    }

    static async getUserFinancialSummary(userId: number): Promise<{
        currency: SupportedCurrency
        total_income: string
        total_expenses: string
        current_balance: string
        this_month_income: string
        this_month_expenses: string
        this_month_balance: string
    }> {
        const { currency } = await this.getUserCurrency(userId)

        const now = new Date()
        const currentMonth = now.getMonth() + 1
        const currentYear = now.getFullYear()

        const result = await prisma.$queryRaw<Array<{
            total_income: string
            total_expenses: string
            month_income: string
            month_expenses: string
        }>>`
            SELECT
                COALESCE((SELECT SUM(quantidade) FROM incomes WHERE user_id = ${userId}), 0) as total_income,
                COALESCE((SELECT SUM(quantidade) FROM expenses WHERE user_id = ${userId}), 0) as total_expenses,
                COALESCE((SELECT SUM(quantidade) FROM incomes WHERE user_id = ${userId} AND EXTRACT(MONTH FROM data) = ${currentMonth} AND EXTRACT(YEAR FROM data) = ${currentYear}), 0) as month_income,
                COALESCE((SELECT SUM(quantidade) FROM expenses WHERE user_id = ${userId} AND EXTRACT(MONTH FROM data) = ${currentMonth} AND EXTRACT(YEAR FROM data) = ${currentYear}), 0) as month_expenses
        `

        const data = result[0]
        const totalIncome = Number(data.total_income)
        const totalExpenses = Number(data.total_expenses)
        const monthIncome = Number(data.month_income)
        const monthExpenses = Number(data.month_expenses)

        return {
            currency,
            total_income: this.formatCurrency(totalIncome, currency),
            total_expenses: this.formatCurrency(totalExpenses, currency),
            current_balance: this.formatCurrency(totalIncome - totalExpenses, currency),
            this_month_income: this.formatCurrency(monthIncome, currency),
            this_month_expenses: this.formatCurrency(monthExpenses, currency),
            this_month_balance: this.formatCurrency(monthIncome - monthExpenses, currency)
        }
    }
}
