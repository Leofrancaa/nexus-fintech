"use client"
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'

const PROTECTED_ROUTES = ['/categorias', '/cartoes', '/limites', '/receitas', '/despesas', '/dashboard', '/planos', '/configuracoes']
const PUBLIC_ROUTES = ['/login', '/register']

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const authenticated = isAuthenticated()
    const isProtected = PROTECTED_ROUTES.some(r => pathname.startsWith(r))
    const isPublic = PUBLIC_ROUTES.includes(pathname)

    if (isProtected && !authenticated) router.replace('/login')
    if (isPublic && authenticated) router.replace('/dashboard')
  }, [pathname, router])

  return <>{children}</>
}
