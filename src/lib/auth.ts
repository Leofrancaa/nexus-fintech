const API_URL = '/api'

// Verificar se está autenticado (lê cookie não-httpOnly de flag)
export const isAuthenticated = (): boolean => {
  if (typeof document === 'undefined') return false
  return document.cookie.includes('nexus_authenticated=1')
}

// Login
export const login = async (data: { email: string; senha: string }) => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || 'E-mail ou senha incorretos.')
  }
  return response.json()
}

// Register
export const register = async (data: { nome: string; email: string; senha: string; inviteCode: string }) => {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || 'Erro ao registrar.')
  }
  return response.json()
}

// Logout
export const logout = async (): Promise<void> => {
  await fetch(`${API_URL}/auth/logout`, { method: 'POST' })
}

// Obter dados do usuário
export const getUserData = async () => {
  const response = await fetch(`${API_URL}/auth/me`)
  if (!response.ok) return null
  const json = await response.json()
  return json.data?.user ?? null
}

// Helper genérico para requisições autenticadas (cookies enviados automaticamente)
// endpoint deve ser o path completo, ex: "/api/expenses"
export const apiRequest = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  // Não forçar Content-Type em uploads (FormData) — o browser define o boundary.
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData

  const headers: HeadersInit = isFormData
    ? { ...options.headers }
    : { 'Content-Type': 'application/json', ...options.headers }

  const response = await fetch(endpoint, { ...options, headers })

  if (response.status === 401) {
    // Sessão expirada/inválida: limpa o flag de autenticação e manda pro login
    // SEM propagar erro, para não disparar toasts ("erro ao carregar...") nas telas.
    if (typeof window !== 'undefined') {
      document.cookie = 'nexus_authenticated=; Max-Age=0; path=/'
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    // Promessa que nunca resolve: a navegação descarta a tela atual, então o
    // código chamador não chega a exibir toast de erro.
    return new Promise<Response>(() => {})
  }

  return response
}
