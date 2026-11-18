import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
})
after(() => server.close())
const { validateLogin, loginErrorMessage } = await server.ssrLoadModule('/src/lib/login.ts')

test('requires email and password and rejects malformed email', () => {
  assert.deepEqual(Object.keys(validateLogin('', '')).sort(), ['email', 'password'])
  for (const email of ['abc', 'a@', 'a b@example.com', 'a@@example.com']) {
    assert.ok(validateLogin(email, 'password').email)
  }
})

test('accepts surrounding email whitespace without enforcing signup password rules', () => {
  assert.deepEqual(validateLogin(' user@example.com ', 'x'), {})
  assert.deepEqual(validateLogin('user@example.com', ' password '), {})
})

test('invalid credentials share a safe message without exposing server details', () => {
  const message = loginErrorMessage(new AuthApiError('private server detail', 400, 'invalid_credentials'))
  assert.match(message, /E-posti aadress või parool on vale/)
  assert.ok(!message.includes('private server detail'))
})

test('network, service, confirmation, and rate-limit errors have useful messages', () => {
  assert.match(loginErrorMessage(new TypeError('Failed to fetch')), /ühendust/)
  assert.match(loginErrorMessage(new AuthRetryableFetchError('network detail', 0)), /ühendust/)
  assert.match(loginErrorMessage(new AuthApiError('detail', 503)), /pole praegu saadaval/)
  assert.match(loginErrorMessage(new AuthApiError('detail', 429)), /Liiga palju/)
  assert.match(loginErrorMessage(new AuthApiError('detail', 400, 'email_not_confirmed')), /kinnitamata/)
  assert.ok(!loginErrorMessage(new Error('private detail')).includes('private detail'))
})

test('unconfigured login renders accessible fields and disables submission', async () => {
  const { AuthContext } = await server.ssrLoadModule('/src/context/AuthContext.tsx')
  const { default: LoginPage } = await server.ssrLoadModule('/src/pages/LoginPage.tsx')
  const html = renderToStaticMarkup(createElement(AuthContext.Provider, {
    value: {
      user: null, session: null, loading: false, error: null,
      configurationError: 'Autentimine pole seadistatud.',
      signOut: async () => {},
    },
  }, createElement(LoginPage)))
  assert.match(html, /for="login-email"/)
  assert.match(html, /for="login-password"/)
  assert.match(html, /autoComplete="current-password"/)
  assert.match(html, /Autentimine pole seadistatud/)
  assert.match(html, /type="submit" disabled/)
  assert.match(html, /Registreerimisleht pole veel saadaval/)
})
