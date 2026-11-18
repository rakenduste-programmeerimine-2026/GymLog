import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const server = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom',
})
after(() => server.close())
const { resolveRoute, safeDestination, authPath } = await server.ssrLoadModule('/src/lib/routes.ts')
const { AppRoutes } = await server.ssrLoadModule('/src/App.tsx')
const { AuthContext } = await server.ssrLoadModule('/src/context/AuthContext.tsx')
const signedOut = { loading: false, authenticated: false }
const signedIn = { loading: false, authenticated: true }

test('logged-out protected routes redirect to login with their intended destination', () => {
  for (const path of ['/workouts', '/exercises', '/stats', '/workouts/123?view=sets']) {
    const route = resolveRoute(path, signedOut)
    assert.equal(route.kind, 'redirect')
    const login = new URL(route.to, 'https://gymlog.invalid')
    assert.equal(login.pathname, '/login')
    assert.equal(login.searchParams.get('next'), path)
  }
})

test('initial session loading never redirects or grants protected access', () => {
  for (const path of ['/workouts', '/exercises', '/stats', '/login', '/']) {
    for (const authenticated of [false, true]) {
      assert.deepEqual(resolveRoute(path, { loading: true, authenticated }), { kind: 'loading' })
    }
  }
})

test('authenticated users can access all protected routes and return from login', () => {
  for (const path of ['/workouts', '/exercises', '/stats']) {
    assert.deepEqual(resolveRoute(path, signedIn), { kind: 'protected', path })
    assert.deepEqual(resolveRoute(authPath('login', path), signedIn), { kind: 'redirect', to: path })
  }
  assert.deepEqual(resolveRoute('/login', signedIn), { kind: 'redirect', to: '/workouts' })
})

test('login/registration remain public and preserve the destination in both directions', () => {
  const destination = '/stats?month=2026-11'
  for (const page of ['login', 'register']) {
    assert.deepEqual(resolveRoute(authPath(page, destination), signedOut), { kind: page, destination })
  }
  // Do not unmount registration when signUp emits SIGNED_IN before showing feedback.
  assert.equal(resolveRoute('/register', signedIn).kind, 'register')
})

test('return destinations reject external, malformed, and non-protected URLs', () => {
  for (const path of [null, 'https://evil.example', '//evil.example/workouts',
    '/\\evil.example/workouts', '/login', '/register', '/workouts-other', '/stats/../../login']) {
    assert.equal(safeDestination(path), null)
  }
  assert.equal(safeDestination('/workouts/123?view=sets#details'), '/workouts/123?view=sets')
  assert.equal(resolveRoute('/login?next=https://evil.example', signedIn).to, '/workouts')
})

function render(path, overrides = {}) {
  const auth = {
    user: null, session: null, loading: false, configurationError: null, error: null,
    signOut: async () => {}, ...overrides,
  }
  return renderToStaticMarkup(createElement(AuthContext.Provider, { value: auth },
    createElement(AppRoutes, { path, navigate: () => {} })))
}

test('protected content and login are not rendered during initial loading or redirect', () => {
  for (const path of ['/workouts', '/exercises', '/stats']) {
    const loading = render(path, { loading: true })
    assert.match(loading, /Laadin sessiooni/)
    assert.ok(!loading.includes('Ajutine kohatäide'))
    assert.ok(!loading.includes('<form'))
    const redirect = render(path)
    assert.match(redirect, /Suunan edasi/)
    assert.ok(!redirect.includes('Ajutine kohatäide'))
  }
})

test('authenticated placeholders render navigation; a user without a session is not sufficient', () => {
  const user = { id: 'test-user' }
  for (const path of ['/workouts', '/exercises', '/stats']) {
    const html = render(path, { user, session: { user } })
    assert.match(html, /Ajutine kohatäide/)
    assert.match(html, /aria-current="page"/)
    assert.ok(!html.includes('<form'))
    assert.match(render(path, { user }), /Suunan edasi/)
  }
})

test('missing configuration still renders public forms and never grants access', () => {
  const configurationError = 'Autentimine pole seadistatud.'
  for (const path of ['/login', '/register']) {
    const html = render(path, { configurationError })
    assert.match(html, /Autentimine pole seadistatud/)
    assert.match(html, /type="submit" disabled/)
  }
  assert.match(render('/stats', { configurationError }), /Suunan edasi/)
})

test('history navigation pushes user navigation, replaces redirects, and notifies listeners', async () => {
  const { navigate } = await server.ssrLoadModule('/src/lib/navigation.ts')
  const originalWindow = globalThis.window
  const originalPopStateEvent = globalThis.PopStateEvent
  const calls = []
  const location = { pathname: '/stats', search: '?month=2026-11' }
  const update = (mode, path) => {
    calls.push([mode, path])
    const url = new URL(path, 'https://gymlog.invalid')
    location.pathname = url.pathname
    location.search = url.search
  }
  let notifications = 0
  globalThis.window = {
    location,
    history: {
      pushState: (_state, _unused, path) => update('push', path),
      replaceState: (_state, _unused, path) => update('replace', path),
    },
    dispatchEvent: () => { notifications++ },
  }
  globalThis.PopStateEvent = class extends Event {}
  try {
    const redirect = resolveRoute('/stats?month=2026-11', signedOut)
    navigate(redirect.to, true)
    navigate(authPath('register', '/stats?month=2026-11'))
    navigate(authPath('login', '/stats?month=2026-11'))
    navigate('/stats?month=2026-11', true)
    navigate('/stats?month=2026-11') // No duplicate entry or event for the same URL.
    assert.deepEqual(calls.map(([mode]) => mode), ['replace', 'push', 'push', 'replace'])
    assert.equal(notifications, 4)
    assert.equal(location.pathname + location.search, '/stats?month=2026-11')
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
    if (originalPopStateEvent === undefined) delete globalThis.PopStateEvent
    else globalThis.PopStateEvent = originalPopStateEvent
  }
})
