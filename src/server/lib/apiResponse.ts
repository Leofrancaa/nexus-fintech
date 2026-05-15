import { NextResponse } from 'next/server'
import { ApiError } from '@/server/types/index'
import { resolveUserMessage } from '@/server/utils/helper'

export function ok<T>(data: T, message?: string, status = 200): NextResponse {
  return NextResponse.json({ success: true, data, message }, { status })
}

export function err(message: string, status = 500, details?: unknown): NextResponse {
  return NextResponse.json(
    { success: false, error: message, details: process.env.NODE_ENV === 'development' ? details : undefined },
    { status }
  )
}

export function apiError(error: unknown, fallback: string): NextResponse {
  const e = error as ApiError
  return err(resolveUserMessage(error, fallback), e?.status ?? 500, e)
}
