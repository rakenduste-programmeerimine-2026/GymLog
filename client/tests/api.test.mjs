import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
after(() => server.close())
const { apiGet, apiPost, apiPut, apiDelete, ApiError } = await server.ssrLoadModule('/src/lib/api.ts')
const baseUrl = 'https://api.example.test'

test('all methods attach the supplied current token, JSON headers/body, and safe fetch defaults', async () => {
  const requests = []
  const options = { baseUrl, fetcher: async (url, init) => {
    requests.push({ url: String(url), ...init })
    return init.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json({ ok: true })
  } }
  assert.deepEqual(await apiGet('/workouts', 'first-session-token', options), { ok: true })
  await apiPost('/workouts', 'refreshed-session-token', { name: 'Treening' }, options)
  await apiPut('/workouts/w1', 'refreshed-session-token', { name: 'Uus nimi' }, options)
  assert.equal(await apiDelete('/workouts/w1', 'refreshed-session-token', options), null)
  assert.deepEqual(requests.map((item) => item.method), ['GET', 'POST', 'PUT', 'DELETE'])
  assert.equal(requests[0].headers.Authorization, 'Bearer first-session-token')
  for (const [index, request] of requests.entries()) {
    assert.equal(request.headers.Accept, 'application/json')
    assert.equal(request.cache, 'no-store')
    assert.equal(request.redirect, 'error')
    assert.equal(request.credentials, 'omit')
    assert.ok(!request.url.includes('session-token'))
    if (index) assert.equal(request.headers.Authorization, 'Bearer refreshed-session-token')
    if (request.method === 'POST' || request.method === 'PUT') {
      assert.equal(request.headers['Content-Type'], 'application/json')
      assert.equal(typeof JSON.parse(request.body).name, 'string')
    } else {
      assert.equal(request.headers['Content-Type'], undefined)
      assert.equal(request.body, undefined)
    }
  }
})

test('joins a configured API prefix/trailing slash and preserves encoded query values', async () => {
  for (const base of [`${baseUrl}/api`, `${baseUrl}/api/`]) {
    let requested
    await apiGet('/stats/calendar?month=2026-11', 'token', {
      baseUrl: base, fetcher: async (url) => { requested = String(url); return Response.json({}) },
    })
    assert.equal(requested, `${baseUrl}/api/stats/calendar?month=2026-11`)
  }
})

test('missing token/configuration and unsafe base URLs/paths fail before fetch without leaking values', async () => {
  let calls = 0
  const fetcher = async () => { calls++; return Response.json({}) }
  for (const token of ['', '   ']) {
    await assert.rejects(apiGet('/workouts', token, { baseUrl, fetcher }),
      (error) => error instanceof ApiError && error.status === 401 && error.kind === 'authentication')
  }
  for (const base of ['', ' ', 'invalid', 'ftp://example.test', 'https://private-user:private-password@example.test',
    `${baseUrl}?secret=private`, `${baseUrl}#private`]) {
    await assert.rejects(apiGet('/workouts', 'token', { baseUrl: base, fetcher }),
      (error) => error.kind === 'configuration' && !error.message.includes('private'))
  }
  for (const path of ['https://other.test', '//other.test', '/https://other.test', '/\\other.test', '/workouts#fragment',
    '/../outside', '/%2e%2e/outside', '/workouts\n']) {
    await assert.rejects(apiGet(path, 'token', { baseUrl: `${baseUrl}/api`, fetcher }), (error) => error.kind === 'configuration')
  }
  assert.equal(calls, 0)
})

test('HTTP failures preserve status and safe error kind without exposing raw response bodies', async () => {
  for (const status of [400, 401, 403, 404, 429, 500]) {
    await assert.rejects(apiGet('/workouts', 'token', {
      baseUrl, fetcher: async () => Response.json({ error: 'private backend detail' }, { status }),
    }), (error) => error instanceof ApiError && error.status === status
      && error.kind === (status === 401 ? 'authentication' : 'http') && !error.message.includes('private'))
  }
})

test('network failures use typed safe errors and writes warn about unknown outcomes without retry', async () => {
  let calls = 0
  const options = { baseUrl, fetcher: async () => { calls++; throw new TypeError('private network detail') } }
  await assert.rejects(apiGet('/workouts', 'token', options), (error) => error.kind === 'network'
    && error.status === undefined && !error.message.includes('private'))
  await assert.rejects(apiPost('/workouts', 'token', {}, options), (error) => error.kind === 'network' && /tulemus pole teada/.test(error.message))
  assert.equal(calls, 2)
})

test('204 does not parse JSON; malformed JSON and body-stream failure remain distinct', async () => {
  let parsed = false
  const empty = new Response(null, { status: 204 })
  empty.json = async () => { parsed = true; throw new Error('should not parse') }
  assert.equal(await apiDelete('/workouts/w1', 'token', { baseUrl, fetcher: async () => empty }), null)
  assert.equal(parsed, false)
  await assert.rejects(apiGet('/workouts', 'token', { baseUrl, fetcher: async () => new Response('private invalid JSON') }),
    (error) => error.kind === 'response' && !error.message.includes('private'))
  const brokenBody = Response.json({})
  brokenBody.json = async () => { throw new TypeError('private stream detail') }
  await assert.rejects(apiGet('/workouts', 'token', { baseUrl, fetcher: async () => brokenBody }), (error) => error.kind === 'network')
})

test('unserializable JSON fails before a write is sent', async () => {
  let called = false
  const circular = {}; circular.self = circular
  await assert.rejects(apiPost('/workouts', 'token', circular, {
    baseUrl, fetcher: async () => { called = true; return Response.json({}) },
  }), (error) => error.kind === 'response')
  assert.equal(called, false)
})

test('pre-aborted requests do not fetch and in-flight cancellation preserves the abort reason', async () => {
  const pre = new AbortController()
  pre.abort()
  let called = false
  await assert.rejects(apiGet('/workouts', 'token', { baseUrl, signal: pre.signal,
    fetcher: async () => { called = true; return Response.json({}) },
  }), (error) => error === pre.signal.reason)
  assert.equal(called, false)
  const controller = new AbortController()
  const promise = apiGet('/workouts', 'token', { baseUrl, signal: controller.signal,
    fetcher: (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))),
  })
  controller.abort()
  await assert.rejects(promise, (error) => error === controller.signal.reason)
})

test('late responses and JSON reads cannot turn cancelled requests into success', async () => {
  const controller = new AbortController()
  let finish
  const request = apiGet('/workouts', 'token', {
    baseUrl, signal: controller.signal, fetcher: () => new Promise((resolve) => { finish = resolve }),
  })
  controller.abort(); finish(Response.json({ private: true }))
  await assert.rejects(request, (error) => error === controller.signal.reason)
  const bodyController = new AbortController()
  const response = Response.json({})
  response.json = async () => { bodyController.abort(); return { private: true } }
  await assert.rejects(apiGet('/workouts', 'token', {
    baseUrl, signal: bodyController.signal, fetcher: async () => response,
  }), (error) => error === bodyController.signal.reason)
})
