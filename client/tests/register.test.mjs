import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
after(() => server.close())
const {
  validateRegister, registerErrorMessage, registerWithPassword,
  registrationReducer, registrationSuccessMessage,
} = await server.ssrLoadModule('/src/lib/register.ts')

test('requires all fields and validates email, password length, and confirmation', () => {
  assert.deepEqual(Object.keys(validateRegister('', '', '')).sort(), ['confirmPassword', 'email', 'password'])
  assert.ok(validateRegister('not-an-email', 'password', 'password').email)
  assert.ok(validateRegister('user@example.com', '1234567', '1234567').password)
  assert.ok(validateRegister('user@example.com', 'password', 'different').confirmPassword)
  assert.deepEqual(validateRegister(' user@example.com ', '12345678', '12345678'), {})
  assert.deepEqual(validateRegister('user@example.com', ' password ', ' password '), {})
  assert.ok(validateRegister('user@example.com', ' password ', 'password').confirmPassword)
})

test('submits only trimmed email and unchanged password; supports both confirmation flows', async () => {
  for (const session of [null, { user: { id: 'test-user' } }]) {
    let submitted
    const client = { auth: { signUp: async (credentials) => {
      submitted = credentials
      return { data: { user: { id: 'test-user' }, session }, error: null }
    } } }
    const result = await registerWithPassword(client, ' user@example.com ', ' password ')
    assert.deepEqual(submitted, { email: 'user@example.com', password: ' password ' })
    assert.equal(result.hasSession, Boolean(session))
  }
})

test('missing configuration and failed or empty signup results never become success', async () => {
  await assert.rejects(registerWithPassword(null, 'user@example.com', 'password'), /seadistatud/)
  const failure = new AuthApiError('private detail', 400, 'weak_password')
  await assert.rejects(registerWithPassword({ auth: {
    signUp: async () => ({ data: {}, error: failure }),
  } }, 'user@example.com', 'password'), (error) => error === failure)
  await assert.rejects(registerWithPassword({ auth: {
    signUp: async () => { throw new TypeError('network detail') },
  } }, 'user@example.com', 'password'), TypeError)
  await assert.rejects(registerWithPassword({ auth: {
    signUp: async () => ({ data: { user: null, session: null }, error: null }),
  } }, 'user@example.com', 'password'), /No sign-up result/)
})

test('submission states replace stale errors and keep confirmation distinct from a session', () => {
  let state = registrationReducer({ status: 'idle' }, { type: 'start' })
  assert.equal(state.status, 'submitting')
  state = registrationReducer(state, { type: 'failed', message: 'Proovi uuesti.' })
  assert.deepEqual(state, { status: 'error', message: 'Proovi uuesti.' })
  state = registrationReducer(state, { type: 'start' })
  assert.deepEqual(state, { status: 'submitting' })
  for (const hasSession of [false, true]) {
    assert.deepEqual(registrationReducer(state, { type: 'succeeded', hasSession }), {
      status: 'success', hasSession,
    })
  }
  assert.deepEqual(registrationReducer(state, { type: 'reset' }), { status: 'idle' })
  assert.match(registrationSuccessMessage(false), /kinnituslink/)
  assert.ok(!registrationSuccessMessage(false).includes('oled sisse logitud'))
  assert.match(registrationSuccessMessage(true), /oled sisse logitud/)
})

test('safe error messages cover network, password policy, rate limiting, and service failures', () => {
  assert.match(registerErrorMessage(new TypeError('private detail')), /internet/)
  assert.match(registerErrorMessage(new AuthRetryableFetchError('private detail', 0)), /internet/)
  assert.match(registerErrorMessage(new AuthApiError('private detail', 422, 'weak_password')), /turvanõuetele/)
  assert.match(registerErrorMessage(new AuthApiError('private detail', 429)), /Liiga palju/)
  assert.match(registerErrorMessage(new AuthApiError('private detail', 503)), /pole praegu saadaval/)
  assert.match(registerErrorMessage(new AuthApiError('private detail', 400, 'signup_disabled')), /pole praegu lubatud/)
  const duplicate = registerErrorMessage(new AuthApiError('private detail', 400, 'user_already_exists'))
  assert.match(duplicate, /Kui sul on juba konto/)
  assert.ok(!duplicate.includes('private detail'))
  assert.ok(!registerErrorMessage(new Error('private detail')).includes('private detail'))
})

test('registration markup has accessible fields, setup feedback, and login navigation', async () => {
  const { AuthContext } = await server.ssrLoadModule('/src/context/AuthContext.tsx')
  const { default: RegisterPage } = await server.ssrLoadModule('/src/pages/RegisterPage.tsx')
  for (const loading of [false, true]) {
    const html = renderToStaticMarkup(createElement(AuthContext.Provider, {
      value: {
        user: null, session: null, loading, error: null,
        configurationError: 'Autentimine pole seadistatud.', signOut: async () => {},
      },
    }, createElement(RegisterPage, { onLogin: () => {} })))
    for (const id of ['register-email', 'register-password', 'register-confirmation']) {
      assert.ok(html.includes(`for="${id}"`))
    }
    assert.equal((html.match(/autoComplete="new-password"/g) ?? []).length, 2)
    assert.match(html, /type="submit" disabled/)
    assert.match(html, /Autentimine pole seadistatud/)
    assert.match(html, /Logi sisse/)
    if (loading) assert.match(html, /Laadin sessiooni/)
  }
})
