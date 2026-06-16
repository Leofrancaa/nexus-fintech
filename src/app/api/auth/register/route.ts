import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { and, eq } from 'drizzle-orm'
import db from '@/server/db/drizzle'
import { users, inviteCodes } from '@/server/db/schema'
import { generateResetToken, sendVerificationEmail } from '@/server/services/emailService'

async function markInviteCodeAsUsed(code: string, userId: number): Promise<boolean> {
  try {
    const result = await db
      .update(inviteCodes)
      .set({ is_used: true, used_by: userId, used_at: new Date() })
      .where(and(eq(inviteCodes.code, code.toUpperCase()), eq(inviteCodes.is_used, false)))
      .returning({ id: inviteCodes.id })
    return result.length > 0
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

    const [invite] = await db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.code, inviteCode.toUpperCase()))
      .limit(1)

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

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1)
    if (existingUser) {
      return NextResponse.json({ success: false, error: 'E-mail já cadastrado.' }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(senha, 12)
    const verificationToken = generateResetToken()
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

    const [user] = await db
      .insert(users)
      .values({
        nome,
        email: email.toLowerCase(),
        senha: hashedPassword,
        currency: 'BRL',
        accepted_terms: true,
        accepted_terms_at: new Date(),
        email_verified: false,
        verification_token: verificationToken,
        verification_expires: verificationExpires,
      })
      .returning({ id: users.id, nome: users.nome, email: users.email })

    await markInviteCodeAsUsed(inviteCode.toUpperCase(), user.id)

    // Envio do e-mail é best-effort: se falhar, a conta existe e o usuário pode
    // pedir reenvio. Não bloqueia o cadastro.
    let emailSent = true
    try {
      await sendVerificationEmail(user.email, verificationToken, user.nome)
    } catch {
      emailSent = false
    }

    // Sem auto-login: o usuário precisa confirmar o e-mail antes de entrar.
    return NextResponse.json(
      {
        success: true,
        message: emailSent
          ? 'Conta criada! Enviamos um link de confirmação para o seu e-mail.'
          : 'Conta criada, mas não conseguimos enviar o e-mail de confirmação. Use "reenviar confirmação".',
        data: { email: user.email, emailSent },
      },
      { status: 201 }
    )
  } catch {
    return NextResponse.json({ success: false, error: 'Erro ao registrar usuário.' }, { status: 500 })
  }
}
