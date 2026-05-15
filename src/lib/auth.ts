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
export const apiRequest = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (response.status === 401) {
    throw new Error('Sessão expirada. Faça login novamente.')
  }
  return response
}
