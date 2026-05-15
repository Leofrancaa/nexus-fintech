import prisma from '@/server/db/prisma'

interface SaveExpenseHistoryParams {
    expense_id: number
    user_id: number
    tipo: string
    alteracao: Record<string, unknown>
}

export const saveExpenseHistory = async ({
    expense_id,
    user_id,
    tipo,
    alteracao,
}: SaveExpenseHistoryParams): Promise<void> => {
    await prisma.$executeRaw`
        INSERT INTO expense_history (expense_id, user_id, tipo, alteracao)
        VALUES (${expense_id}, ${user_id}, ${tipo}, ${JSON.stringify(alteracao)}::jsonb)
    `
}
