export type ApiErrorKind = 'http' | 'network' | 'configuration' | 'authentication' | 'response'

export class ApiError extends Error {
  constructor(message: string, readonly status?: number, readonly kind: ApiErrorKind = 'response') {
    super(message)
    this.name = 'ApiError'
  }
}

export interface ApiOptions {
  signal?: AbortSignal
  baseUrl?: string
  fetcher?: typeof fetch
}

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

function requestUrl(path: string, configuredBase: string | undefined): URL {
  if (!configuredBase?.trim()) {
    throw new ApiError('Backend API aadress pole seadistatud. Lisa client/.env.local faili VITE_API_URL ja taaskäivita arendusserver.', undefined, 'configuration')
  }
  try {
    const base = new URL(configuredBase.trim())
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error()
    if (!path.startsWith('/') || path.startsWith('//') || /[\\#\u0000-\u0020\u007f]/.test(path)) throw new Error()
    base.pathname = base.pathname.replace(/\/+$/, '') + '/'
    const url = new URL(path.slice(1), base)
    // Never send a user's bearer token outside the configured API origin/prefix.
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw new Error()
    return url
  } catch {
    throw new ApiError('Backend API aadressi või päringu tee seadistus on vigane.', undefined, 'configuration')
  }
}

function throwIfAborted(signal?: AbortSignal) {
  signal?.throwIfAborted()
}

function networkError(method: ApiMethod): ApiError {
  return new ApiError(method === 'GET'
    ? 'Ühendus serveriga ebaõnnestus. Kontrolli internetiühendust ja proovi uuesti.'
    : 'Ühendus serveriga ebaõnnestus. Toimingu tulemus pole teada. Kontrolli andmeid enne uuesti proovimist.', undefined, 'network')
}

// No token storage, global response cache, or automatic write retries.
export async function apiRequest(path: string, accessToken: string, method: ApiMethod, body: unknown,
  options: ApiOptions = {}): Promise<unknown> {
  throwIfAborted(options.signal)
  if (!accessToken.trim()) throw new ApiError('Sisselogimine on vajalik.', 401, 'authentication')
  const url = requestUrl(path, options.baseUrl ?? import.meta.env.VITE_API_URL)
  let encodedBody: string | undefined
  try { encodedBody = method === 'POST' || method === 'PUT' ? JSON.stringify(body) : undefined }
  catch { throw new ApiError('Päringu andmed pole loetavad.') }
  let response: Response
  try {
    response = await (options.fetcher ?? fetch)(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`, Accept: 'application/json',
        ...(method === 'POST' || method === 'PUT' ? { 'Content-Type': 'application/json' } : {}),
      },
      body: encodedBody,
      signal: options.signal,
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
    })
  } catch (error: unknown) {
    throwIfAborted(options.signal)
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw networkError(method)
  }
  throwIfAborted(options.signal)
  if (!response.ok) {
    if (response.status === 401) throw new ApiError('Sessioon ei kehti või on aegunud. Logi uuesti sisse.', 401, 'authentication')
    if (response.status === 403) throw new ApiError('Sul puudub õigus seda toimingut teha.', 403, 'http')
    if (response.status === 404) throw new ApiError('Andmeid ei leitud.', 404, 'http')
    throw new ApiError(method === 'POST' || method === 'PUT' ? 'Salvestamine ebaõnnestus. Kontrolli sisestatud andmeid ja proovi uuesti.'
      : method === 'DELETE' ? 'Treeningu kustutamine ebaõnnestus. Proovi uuesti.'
      : 'Andmeid ei saanud laadida. Proovi uuesti.', response.status, 'http')
  }
  if (response.status === 204) return null
  try {
    const payload: unknown = await response.json()
    throwIfAborted(options.signal)
    return payload
  } catch (error: unknown) {
    throwIfAborted(options.signal)
    if (error instanceof Error && error.name === 'AbortError') throw error
    if (!(error instanceof SyntaxError)) throw networkError(method)
    throw new ApiError('Serveri vastus pole loetav. Proovi hiljem uuesti.', response.status, 'response')
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
