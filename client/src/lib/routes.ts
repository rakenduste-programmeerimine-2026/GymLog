export const protectedPages = {
  '/workouts': 'Treeningud',
  '/exercises': 'Harjutused',
  '/stats': 'Statistika',
} as const

export type ProtectedPath = keyof typeof protectedPages

export function protectedPath(pathname: string): ProtectedPath | null {
  return (Object.keys(protectedPages) as ProtectedPath[]).find(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  ) ?? null
}

// Only allow known, same-origin protected destinations, including their query.
export function safeDestination(candidate: string | null): string | null {
  if (!candidate?.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) return null
  try {
    const url = new URL(candidate, 'https://gymlog.invalid')
    if (url.origin !== 'https://gymlog.invalid' || !protectedPath(url.pathname)) return null
    return url.pathname + url.search
  } catch {
    return null
  }
}

export function authPath(page: 'login' | 'register', destination: string | null): string {
  const next = safeDestination(destination)
  return `/${page}${next ? `?next=${encodeURIComponent(next)}` : ''}`
}

export type RouteDecision =
  | { kind: 'loading' }
  | { kind: 'redirect'; to: string }
  | { kind: 'login'; destination: string | null }
  | { kind: 'register'; destination: string | null }
  | { kind: 'protected'; path: ProtectedPath }
  | { kind: 'home' }
  | { kind: 'not-found' }

export function resolveRoute(
  location: string,
  auth: { loading: boolean; authenticated: boolean },
): RouteDecision {
  const url = new URL(location, 'https://gymlog.invalid')
  const path = protectedPath(url.pathname)
  const destination = safeDestination(url.searchParams.get('next'))

  if (path) {
    if (auth.loading) return { kind: 'loading' }
    if (!auth.authenticated) {
      return { kind: 'redirect', to: authPath('login', url.pathname + url.search) }
    }
    return { kind: 'protected', path }
  }
  // Registration must remain mounted to display the result of signUp.
  if (url.pathname === '/register') return { kind: 'register', destination }
  if (url.pathname === '/login' || url.pathname === '/') {
    if (auth.loading) return { kind: 'loading' }
    if (auth.authenticated) {
      if (url.pathname === '/login') return { kind: 'redirect', to: destination ?? '/workouts' }
      return { kind: 'home' }
    }
    return { kind: 'login', destination }
  }
  return { kind: 'not-found' }
}
