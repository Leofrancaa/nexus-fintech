import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../mocks/db'
import * as schema from '@/server/db/schema'
import { ChatService } from '@/server/services/chatService'

// IA mockada — sem rede, resposta determinística.
vi.mock('@/server/services/llmService', () => ({
  isLlmConfigured: () => true,
  chatText: vi.fn(async () => 'Seu maior gasto foi com Alimentação.'),
  chatJson: vi.fn(),
}))

const USER_ID = 1

beforeEach(async () => {
  // Algum dado financeiro para o construtor de contexto.
  await db.insert(schema.expenses).values([
    {
      metodo_pagamento: 'pix',
      tipo: 'Mercado',
      quantidade: '300',
      data: new Date(),
      user_id: USER_ID,
    },
    {
      metodo_pagamento: 'pix',
      tipo: 'Uber',
      quantidade: '50',
      data: new Date(),
      user_id: USER_ID,
    },
  ])
})

describe('ChatService.getStatus', () => {
  it('começa com o limite completo disponível', async () => {
    const status = await ChatService.getStatus(USER_ID)
    expect(status.limit).toBe(4)
    expect(status.used).toBe(0)
    expect(status.remaining).toBe(4)
  })
})

describe('ChatService.sendMessage', () => {
  it('responde, armazena as mensagens e decrementa o restante', async () => {
    const result = await ChatService.sendMessage(USER_ID, 'Qual meu maior gasto?')

    expect(result.reply).toContain('Alimentação')
    expect(result.status.used).toBe(1)
    expect(result.status.remaining).toBe(3)

    const stored = await ChatService.getHistory(USER_ID)
    expect(stored).toHaveLength(2) // user + assistant
    expect(stored[0].role).toBe('user')
    expect(stored[1].role).toBe('assistant')
  })

  it('bloqueia após atingir o limite diário de 4 mensagens', async () => {
    for (let i = 0; i < 4; i++) {
      await ChatService.sendMessage(USER_ID, `Pergunta ${i}`)
    }
    await expect(ChatService.sendMessage(USER_ID, 'Mais uma')).rejects.toMatchObject({
      status: 429,
    })
  })

  it('rejeita mensagem vazia', async () => {
    await expect(ChatService.sendMessage(USER_ID, '   ')).rejects.toMatchObject({ status: 400 })
  })

  it('rejeita mensagem muito longa', async () => {
    await expect(
      ChatService.sendMessage(USER_ID, 'a'.repeat(600))
    ).rejects.toMatchObject({ status: 400 })
  })
})

describe('ChatService.getHistory', () => {
  it('retorna o histórico em ordem cronológica', async () => {
    await ChatService.sendMessage(USER_ID, 'Primeira')
    await ChatService.sendMessage(USER_ID, 'Segunda')

    const history = await ChatService.getHistory(USER_ID)
    expect(history).toHaveLength(4)
    expect(history[0].content).toBe('Primeira')
    expect(history[2].content).toBe('Segunda')
  })
})
