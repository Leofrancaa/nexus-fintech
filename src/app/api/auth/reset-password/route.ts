import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { and, eq, gt } from 'drizzle-orm'
import db from '@/server/db/drizzle'
import { users } from '@/server/db/schema'

export async function POST(request: NextRequest) {
  try {
    const { token, novaSenha } = await request.json()

    if (!token || !novaSenha) {
      return NextResponse.json({ success: false, error: 'Token e nova senha são obrigatórios.' }, { status: 400 })
    }

    if (novaSenha.length < 6) {
      return NextResponse.json({ success: false, error: 'A nova senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
    }

    const [user] = await db
      .select({ id: users.id, email: users.email, nome: users.nome })
      .from(users)
      .where(
        and(
          eq(users.reset_password_token, token),
          gt(users.reset_password_expires, new Date())
        )
      )
      .limit(1)

    if (!user) {
      return NextResponse.json({ success: false, error: 'Token inválido ou expirado.' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(novaSenha, 12)

    await db
      .update(users)
      .set({ senha: hashedPassword, reset_password_token: null, reset_password_expires: null })
      .where(eq(users.id, user.id))

    return NextResponse.json({ success: true, message: 'Senha redefinida com sucesso. Você já pode fazer login.' })
  } catch {
    return NextResponse.json({ success: false, error: 'Erro ao redefinir senha.' }, { status: 500 })
  }
}
