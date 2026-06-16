import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { ChatService } from '@/server/services/chatService'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const [messages, status] = await Promise.all([
      ChatService.getHistory(user.id),
      ChatService.getStatus(user.id),
    ])
    return ok({ messages, status }, 'Histórico do assistente recuperado.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar histórico do assistente.')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const { message } = await request.json()
    if (!message || typeof message !== 'string') {
      return err('Mensagem é obrigatória.', 400)
    }
    const result = await ChatService.sendMessage(user.id, message)
    return ok(result, 'Resposta do assistente.')
  } catch (error) {
    return apiError(error, 'Erro ao conversar com o assistente.')
  }
}
