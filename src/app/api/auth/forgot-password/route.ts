import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import db from '@/server/db/drizzle'
import { users } from '@/server/db/schema'
import { generateResetToken, sendPasswordResetEmail } from '@/server/services/emailService'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email é obrigatório.' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ success: false, error: 'Email inválido.' }, { status: 400 })
    }

    const [user] = await db
      .select({ id: users.id, nome: users.nome, email: users.email })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1)

    if (!user) {
      return NextResponse.json({ success: true, message: 'Se o email estiver cadastrado, você receberá um link de recuperação.' })
    }

    const resetToken = generateResetToken()
    const resetExpires = new Date(Date.now() + 3600000)

    await db
      .update(users)
      .set({ reset_password_token: resetToken, reset_password_expires: resetExpires })
      .where(eq(users.id, user.id))

    try {
      await sendPasswordResetEmail(user.email, resetToken, user.nome)
    } catch {
      await db
        .update(users)
        .set({ reset_password_token: null, reset_password_expires: null })
        .where(eq(users.id, user.id))
      return NextResponse.json({ success: false, error: 'Erro ao enviar email de recuperação.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Se o email estiver cadastrado, você receberá um link de recuperação.' })
  } catch {
    return NextResponse.json({ success: false, error: 'Erro ao processar solicitação.' }, { status: 500 })
  }
}
