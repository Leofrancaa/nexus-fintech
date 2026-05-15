import { ok } from '@/server/lib/apiResponse'
import { CurrencyService } from '@/server/services/currencyService'

export async function GET() {
  const currencies = CurrencyService.getSupportedCurrencies()
  return ok(currencies, 'Moedas suportadas recuperadas com sucesso.')
}
