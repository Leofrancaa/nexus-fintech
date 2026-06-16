import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import db from '@/server/db/drizzle'
import { users } from '@/server/db/schema'
import { generateResetToken, sendVerificationEmail } from '@/server/services/emailService'

// Reenvia o e-mail de confirmação para uma conta ainda não verificada.
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ success: false, error: 'E-mail é obrigatório.' }, { status: 400 })
    }

    const [user] = await db
      .select({
        id: users.id,
        nome: users.nome,
        email: users.email,
        email_verified: users.email_verified,
      })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1)

    // Resposta genérica para não revelar quais e-mails existem.
    const generic = NextResponse.json({
      success: true,
      message: 'Se o e-mail estiver cadastrado e pendente, reenviamos o link de confirmação.',
    })

    if (!user) return generic
    if (user.email_verified) {
      return NextResponse.json({
        success: true,
        message: 'Este e-mail já foi confirmado. Você já pode fazer login.',
      })
    }

    const token = generateResetToken()
    await db
      .update(users)
      .set({
        verification_token: token,
        verification_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .where(eq(users.id, user.id))

    try {
      await sendVerificationEmail(user.email, token, user.nome)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Erro ao enviar o e-mail de confirmação. Tente novamente em instantes.' },
        { status: 500 }
      )
    }

    return generic
  } catch {
    return NextResponse.json({ success: false, error: 'Erro ao reenviar confirmação.' }, { status: 500 })
  }
}
