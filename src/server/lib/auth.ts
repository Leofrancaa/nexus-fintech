import jwt from 'jsonwebtoken'
import { NextRequest, NextResponse } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET não definido')

const COOKIE_NAME = 'nexus_token'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 30, // 30 dias
  path: '/',
}

export interface JWTPayload {
  id: number
  nome: string
  email: string
  iat: number
  exp: number
}

export function createToken(payload: { id: number; nome: string; email: string }): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: '30d' })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET!) as JWTPayload
  } catch {
    return null
  }
}

export function getAuthUser(request: NextRequest): JWTPayload | null {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE_NAME, token, COOKIE_OPTIONS)
}

export function setAuthFlagCookie(response: NextResponse): void {
  response.cookies.set('nexus_authenticated', '1', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, '', { ...COOKIE_OPTIONS, maxAge: 0 })
  response.cookies.set('nexus_authenticated', '', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 0,
    path: '/',
  })
}

export function unauthorizedResponse(message = 'Não autorizado'): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 401 })
}
