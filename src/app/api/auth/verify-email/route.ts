import { NextRequest, NextResponse } from 'next/server'
import { and, eq, gt } from 'drizzle-orm'
import db from '@/server/db/drizzle'
import { users } from '@/server/db/schema'

// Confirma o e-mail a partir do token enviado no link (página /verify-email).
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token ausente.' }, { status: 400 })
    }

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.verification_token, token),
          gt(users.verification_expires, new Date())
        )
      )
      .limit(1)

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Link inválido ou expirado. Solicite um novo e-mail de confirmação.' },
        { status: 400 }
      )
    }

    await db
      .update(users)
      .set({ email_verified: true, verification_token: null, verification_expires: null })
      .where(eq(users.id, user.id))

    return NextResponse.json({ success: true, message: 'E-mail confirmado! Você já pode entrar.' })
  } catch {
    return NextResponse.json({ success: false, error: 'Erro ao confirmar e-mail.' }, { status: 500 })
  }
}
