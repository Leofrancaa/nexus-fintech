import { NextResponse } from 'next/server'
import { clearAuthCookie } from '@/server/lib/auth'

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Logout realizado com sucesso.' })
  clearAuthCookie(response)
  return response
}
