import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/server/db/prisma'
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

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, nome: true, email: true }
    })

    if (!user) {
      return NextResponse.json({ success: true, message: 'Se o email estiver cadastrado, você receberá um link de recuperação.' })
    }

    const resetToken = generateResetToken()
    const resetExpires = new Date(Date.now() + 3600000)

    await prisma.user.update({
      where: { id: user.id },
      data: { reset_password_token: resetToken, reset_password_expires: resetExpires }
    })

    try {
      await sendPasswordResetEmail(user.email, resetToken, user.nome)
    } catch {
      await prisma.user.update({
        where: { id: user.id },
        data: { reset_password_token: null, reset_password_expires: null }
      })
      return NextResponse.json({ success: false, error: 'Erro ao enviar email de recuperação.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Se o email estiver cadastrado, você receberá um link de recuperação.' })
  } catch {
    return NextResponse.json({ success: false, error: 'Erro ao processar solicitação.' }, { status: 500 })
  }
}
