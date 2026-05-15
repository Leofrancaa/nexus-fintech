import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import prisma from '@/server/db/prisma'

export async function POST(request: NextRequest) {
  try {
    const { token, novaSenha } = await request.json()

    if (!token || !novaSenha) {
      return NextResponse.json({ success: false, error: 'Token e nova senha são obrigatórios.' }, { status: 400 })
    }

    if (novaSenha.length < 6) {
      return NextResponse.json({ success: false, error: 'A nova senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: {
        reset_password_token: token,
        reset_password_expires: { gt: new Date() }
      },
      select: { id: true, email: true, nome: true }
    })

    if (!user) {
      return NextResponse.json({ success: false, error: 'Token inválido ou expirado.' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(novaSenha, 12)

    await prisma.user.update({
      where: { id: user.id },
      data: { senha: hashedPassword, reset_password_token: null, reset_password_expires: null }
    })

    return NextResponse.json({ success: true, message: 'Senha redefinida com sucesso. Você já pode fazer login.' })
  } catch {
    return NextResponse.json({ success: false, error: 'Erro ao redefinir senha.' }, { status: 500 })
  }
}
