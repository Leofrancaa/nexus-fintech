import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { CardService } from '@/server/services/cardService'
import { toNumber, isPositiveNumber, isValidHexColor } from '@/server/utils/helper'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { id } = await params
    const cardId = toNumber(id)
    if (!cardId) return err('ID do cartão inválido.', 400)

    const card = await CardService.getCardById(cardId, user.id)
    if (!card) return err('Cartão não encontrado.', 404)

    return ok(card, 'Cartão recuperado com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar cartão.')
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { id } = await params
    const cardId = toNumber(id)
    if (!cardId) return err('ID do cartão inválido.', 400)

    const updateData = await request.json()

    if (updateData.limite !== undefined && !isPositiveNumber(updateData.limite)) {
      return err('Limite deve ser um número positivo.', 400)
    }

    if (updateData.cor && !isValidHexColor(updateData.cor)) {
      return err('Cor deve estar no formato hexadecimal válido.', 400)
    }

    const updatedCard = await CardService.updateCard(cardId, updateData, user.id)
    return ok(updatedCard, 'Cartão atualizado com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao atualizar cartão.')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { id } = await params
    const cardId = toNumber(id)
    if (!cardId) return err('ID do cartão inválido.', 400)

    const result = await CardService.deleteCard(cardId, user.id)
    return ok(result, result.message)
  } catch (error) {
    return apiError(error, 'Erro ao deletar cartão.')
  }
}
