import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { eq } from 'drizzle-orm'
import db from '@/server/db/drizzle'
import { users } from '@/server/db/schema'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { senhaAtual, novaSenha } = await request.json()

    if (!senhaAtual || !novaSenha) {
      return NextResponse.json({ success: false, error: 'Senha atual e nova senha são obrigatórias.' }, { status: 400 })
    }

    if (novaSenha.length < 6) {
      return NextResponse.json({ success: false, error: 'A nova senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
    }

    const [dbUser] = await db
      .select({ id: users.id, senha: users.senha })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)

    if (!dbUser || !dbUser.senha) {
      return NextResponse.json({ success: false, error: 'Usuário não encontrado.' }, { status: 404 })
    }

    const isPasswordCorrect = await bcrypt.compare(senhaAtual, dbUser.senha)
    if (!isPasswordCorrect) {
      return NextResponse.json({ success: false, error: 'Senha atual incorreta.' }, { status: 401 })
    }

    const hashedPassword = await bcrypt.hash(novaSenha, 12)

    await db.update(users).set({ senha: hashedPassword }).where(eq(users.id, user.id))

    return NextResponse.json({ success: true, message: 'Senha alterada com sucesso.' })
  } catch {
    return NextResponse.json({ success: false, error: 'Erro ao alterar senha.' }, { status: 500 })
  }
}
