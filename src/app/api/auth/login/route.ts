import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import prisma from '@/server/db/prisma'
import { createToken, setAuthCookie, setAuthFlagCookie } from '@/server/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, senha } = await request.json()

    if (!email || !senha) {
      return NextResponse.json({ success: false, error: 'E-mail e senha são obrigatórios.' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, nome: true, email: true, senha: true, currency: true, created_at: true, updated_at: true }
    })

    if (!user || !user.senha) {
      return NextResponse.json({ success: false, error: 'E-mail ou senha incorretos.' }, { status: 401 })
    }

    const isPasswordCorrect = await bcrypt.compare(senha, user.senha)
    if (!isPasswordCorrect) {
      return NextResponse.json({ success: false, error: 'E-mail ou senha incorretos.' }, { status: 401 })
    }

    const { senha: _, ...userWithoutPassword } = user
    const token = createToken({ id: user.id, nome: user.nome, email: user.email })

    const response = NextResponse.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: { user: userWithoutPassword, token }
    })

    setAuthCookie(response, token)
    setAuthFlagCookie(response)

    return response
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Erro ao fazer login.' }, { status: 500 })
  }
}
