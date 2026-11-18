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

// Small authenticated GET helper; no token storage or global response cache.
export async function apiGet(path: string, accessToken: string, options: ApiOptions = {}): Promise<unknown> {
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
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    signal: options.signal,
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
  })
  if (!response.ok) {
    if (response.status === 401) throw new ApiError('Sessioon ei kehti või on aegunud. Logi uuesti sisse.', 401)
    if (response.status === 403) throw new ApiError('Sul puudub õigus neid treeninguid vaadata.', 403)
    throw new ApiError('Treeninguid ei saanud laadida. Proovi uuesti.', response.status)
  }
  try {
    return await response.json()
  } catch {
    throw new ApiError('Serveri vastus pole loetav. Proovi hiljem uuesti.')
  }
}
