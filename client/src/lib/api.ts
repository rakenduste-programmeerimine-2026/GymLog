export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface ApiOptions {
  signal?: AbortSignal
  baseUrl?: string
  fetcher?: typeof fetch
}

// No token storage, global response cache, or automatic write retries.
async function apiRequest(path: string, accessToken: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', body: unknown,
  options: ApiOptions = {}): Promise<unknown> {
  if (!accessToken) throw new ApiError('Sisselogimine on vajalik.', 401)
  const baseUrl = options.baseUrl ?? import.meta.env.VITE_API_URL?.trim()
  if (!baseUrl) throw new ApiError('Backend API aadress pole seadistatud. Lisa client/.env.local faili VITE_API_URL ja taaskäivita arendusserver.')
  let url: URL
  try {
    const base = new URL(baseUrl)
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error()
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) throw new Error()
    url = new URL(base.toString().replace(/\/$/, '') + path)
  } catch {
    throw new ApiError('Backend API aadressi seadistus on vigane.')
  }
  const response = await (options.fetcher ?? fetch)(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`, Accept: 'application/json',
      ...(method === 'POST' || method === 'PUT' ? { 'Content-Type': 'application/json' } : {}),
    },
    body: method === 'POST' || method === 'PUT' ? JSON.stringify(body) : undefined,
    signal: options.signal,
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
  })
  if (!response.ok) {
    if (response.status === 401) throw new ApiError('Sessioon ei kehti või on aegunud. Logi uuesti sisse.', 401)
    if (response.status === 403) throw new ApiError('Sul puudub õigus seda toimingut teha.', 403)
    if (response.status === 404) throw new ApiError('Treeningut ei leitud.', 404)
    throw new ApiError(method === 'POST' || method === 'PUT' ? 'Salvestamine ebaõnnestus. Kontrolli sisestatud andmeid ja proovi uuesti.'
      : method === 'DELETE' ? 'Treeningu kustutamine ebaõnnestus. Proovi uuesti.'
      : 'Andmeid ei saanud laadida. Proovi uuesti.', response.status)
  }
  if (response.status === 204) return null
  try {
    return await response.json()
  } catch {
    throw new ApiError('Serveri vastus pole loetav. Proovi hiljem uuesti.')
  }
}

export function apiGet(path: string, accessToken: string, options: ApiOptions = {}): Promise<unknown> {
  return apiRequest(path, accessToken, 'GET', undefined, options)
}

export function apiPost(path: string, accessToken: string, body: unknown, options: ApiOptions = {}): Promise<unknown> {
  return apiRequest(path, accessToken, 'POST', body, options)
}

export function apiPut(path: string, accessToken: string, body: unknown, options: ApiOptions = {}): Promise<unknown> {
  return apiRequest(path, accessToken, 'PUT', body, options)
}

export function apiDelete(path: string, accessToken: string, options: ApiOptions = {}): Promise<unknown> {
  return apiRequest(path, accessToken, 'DELETE', undefined, options)
}
