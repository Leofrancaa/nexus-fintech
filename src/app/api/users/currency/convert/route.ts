import { NextRequest } from 'next/server'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { CurrencyService } from '@/server/services/currencyService'

export async function POST(request: NextRequest) {
  try {
    const { amount, from_currency, to_currency } = await request.json()
    if (!amount || !from_currency || !to_currency) {
      return err('Amount, from_currency e to_currency são obrigatórios.', 400)
    }
    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      return err('Amount deve ser um número positivo.', 400)
    }
    const result = await CurrencyService.convertCurrency(Number(amount), from_currency, to_currency)
    return ok(result, 'Conversão realizada com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao converter moeda.')
  }
}
