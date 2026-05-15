import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import prisma from '@/server/db/prisma'
import { createToken, setAuthCookie, setAuthFlagCookie } from '@/server/lib/auth'

async function markInviteCodeAsUsed(code: string, userId: number): Promise<boolean> {
  try {
    const result = await prisma.inviteCode.updateMany({
      where: { code: code.toUpperCase(), is_used: false },
      data: { is_used: true, used_by: userId, used_at: new Date() },
    })
    return result.count > 0
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const { nome, email, senha, inviteCode } = await request.json()

    if (!nome || !email || !senha) {
      return NextResponse.json({ success: false, error: 'Nome, e-mail e senha são obrigatórios.' }, { status: 400 })
    }

    if (!inviteCode) {
      return NextResponse.json({ success: false, error: 'Código de convite é obrigatório.' }, { status: 400 })
    }

    const invite = await prisma.inviteCode.findFirst({ where: { code: inviteCode.toUpperCase() } })

    if (!invite) {
      return NextResponse.json({ success: false, error: 'Código de convite inválido.' }, { status: 400 })
    }

    if (invite.is_used) {
      return NextResponse.json({ success: false, error: 'Este código de convite já foi utilizado.' }, { status: 400 })
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ success: false, error: 'Este código de convite expirou.' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ success: false, error: 'Email inválido.' }, { status: 400 })
    }

    if (senha.length < 6) {
      return NextResponse.json({ success: false, error: 'Senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existingUser) {
      return NextResponse.json({ success: false, error: 'E-mail já cadastrado.' }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(senha, 12)

    const user = await prisma.user.create({
      data: {
        nome,
        email: email.toLowerCase(),
        senha: hashedPassword,
        currency: 'BRL',
        accepted_terms: true,
        accepted_terms_at: new Date(),
      },
      select: { id: true, nome: true, email: true, currency: true, created_at: true, updated_at: true }
    })

    await markInviteCodeAsUsed(inviteCode.toUpperCase(), user.id)

    const token = createToken({ id: user.id, nome: user.nome, email: user.email })

    const response = NextResponse.json({
      success: true,
      message: 'Usuário registrado com sucesso',
      data: { user, token }
    }, { status: 201 })

    setAuthCookie(response, token)
    setAuthFlagCookie(response)

    return response
  } catch {
    return NextResponse.json({ success: false, error: 'Erro ao registrar usuário.' }, { status: 500 })
  }
}
