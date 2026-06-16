import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { eq } from 'drizzle-orm'
import db from '@/server/db/drizzle'
import { users } from '@/server/db/schema'
import { createToken, setAuthCookie, setAuthFlagCookie } from '@/server/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, senha } = await request.json()

    if (!email || !senha) {
      return NextResponse.json({ success: false, error: 'E-mail e senha são obrigatórios.' }, { status: 400 })
    }

    const [user] = await db
      .select({
        id: users.id,
        nome: users.nome,
        email: users.email,
        senha: users.senha,
        currency: users.currency,
        created_at: users.created_at,
        updated_at: users.updated_at,
      })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1)

    if (!user || !user.senha) {
      return NextResponse.json({ success: false, error: 'E-mail ou senha incorretos.' }, { status: 401 })
    }

    const isPasswordCorrect = await bcrypt.compare(senha, user.senha)
    if (!isPasswordCorrect) {
      return NextResponse.json({ success: false, error: 'E-mail ou senha incorretos.' }, { status: 401 })
    }

    const userWithoutPassword = { id: user.id, nome: user.nome, email: user.email, currency: user.currency, created_at: user.created_at, updated_at: user.updated_at }
    const token = createToken({ id: user.id, nome: user.nome, email: user.email })

    const response = NextResponse.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: { user: userWithoutPassword, token }
    })

    setAuthCookie(response, token)
    setAuthFlagCookie(response)

    return response
  } catch {
    return NextResponse.json({ success: false, error: 'Erro ao fazer login.' }, { status: 500 })
  }
}
