import { NextRequest } from 'next/server'
import { ok } from '@/server/lib/apiResponse'
import { CurrencyService } from '@/server/services/currencyService'

export async function GET(request: NextRequest) {
  const currencies = CurrencyService.getSupportedCurrencies()
  return ok(currencies, 'Moedas suportadas recuperadas com sucesso.')
}
