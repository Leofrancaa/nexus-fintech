import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import prisma from '@/server/db/prisma'
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

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, senha: true }
    })

    if (!dbUser || !dbUser.senha) {
      return NextResponse.json({ success: false, error: 'Usuário não encontrado.' }, { status: 404 })
    }

    const isPasswordCorrect = await bcrypt.compare(senhaAtual, dbUser.senha)
    if (!isPasswordCorrect) {
      return NextResponse.json({ success: false, error: 'Senha atual incorreta.' }, { status: 401 })
    }

    const hashedPassword = await bcrypt.hash(novaSenha, 12)

    await prisma.user.update({
      where: { id: user.id },
      data: { senha: hashedPassword }
    })

    return NextResponse.json({ success: true, message: 'Senha alterada com sucesso.' })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Erro ao alterar senha.' }, { status: 500 })
  }
}
