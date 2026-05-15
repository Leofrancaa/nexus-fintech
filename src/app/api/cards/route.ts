import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { CardService } from '@/server/services/cardService'
import { isPositiveNumber, isValidHexColor } from '@/server/utils/helper'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const cards = await CardService.getCardsByUser(user.id)
    return ok(cards, 'Cartões recuperados com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar cartões.')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const cardData = await request.json()

    if (!cardData.nome || !cardData.tipo || !cardData.numero) {
      return err('Nome, tipo e número são obrigatórios.', 400)
    }

    const tiposValidos = ['crédito', 'débito', 'credito', 'debito']
    if (!tiposValidos.includes(cardData.tipo)) {
      return err('Tipo deve ser "crédito" ou "débito".', 400)
    }

    const tipoNormalizado = cardData.tipo === 'credito' ? 'crédito' :
                           cardData.tipo === 'debito' ? 'débito' :
                           cardData.tipo

    if (tipoNormalizado === 'crédito') {
      if (!cardData.limite) return err('Limite é obrigatório para cartões de crédito.', 400)
      if (!isPositiveNumber(cardData.limite)) return err('Limite deve ser um número positivo.', 400)
      if (!cardData.dia_vencimento) return err('Dia de vencimento é obrigatório para cartões de crédito.', 400)
    } else {
      cardData.limite = 0
    }

    if (cardData.cor && !isValidHexColor(cardData.cor)) {
      return err('Cor deve estar no formato hexadecimal válido.', 400)
    }

    cardData.tipo = tipoNormalizado

    const result = await CardService.createCard(cardData, user.id)
    return ok(result, 'Cartão criado com sucesso.', 201)
  } catch (error) {
    return apiError(error, 'Erro ao criar cartão.')
  }
}
