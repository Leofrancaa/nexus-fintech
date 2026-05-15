import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'

export async function GET(request: NextRequest) {
  const user = getAuthUser(request)
  if (!user) return unauthorizedResponse()

  return NextResponse.json({
    success: true,
    data: {
      user: { id: user.id, nome: user.nome, email: user.email }
    }
  })
}
