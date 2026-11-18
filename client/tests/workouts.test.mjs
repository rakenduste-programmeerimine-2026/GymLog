import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { setImmediate as tick } from 'node:timers/promises'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const server = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom',
})
after(() => server.close())
const { apiGet, ApiError } = await server.ssrLoadModule('/src/lib/api.ts')
const { fetchWorkouts, startWorkoutsRequest } = await server.ssrLoadModule('/src/lib/workouts.ts')
const { WorkoutsContent } = await server.ssrLoadModule('/src/pages/WorkoutsPage.tsx')
const baseUrl = 'http://localhost:3001'
const row = (overrides = {}) => ({ id: 'w1', user_id: 'user-a', name: 'Jalgade treening', date: '2026-11-18', ...overrides })
const optionsFor = (payload, status = 200) => ({
  baseUrl, fetcher: async () => Response.json(payload, { status }),
})

test('GET /workouts sends the access token in a header, not the URL, and never caches', async () => {
  let request
  await fetchWorkouts('user-a', 'test-access-token', {
    baseUrl, fetcher: async (url, options) => {
      request = { url: String(url), ...options }
      return Response.json([row()])
    },
  })
  assert.equal(request.url, `${baseUrl}/workouts`)
  assert.equal(request.method, 'GET')
  assert.equal(request.headers.Authorization, 'Bearer test-access-token')
  assert.equal(request.cache, 'no-store')
  assert.equal(request.redirect, 'error')
  assert.equal(request.credentials, 'omit')
})

test('returns empty data, real names or a fallback, and newest-first ordering', async () => {
  assert.deepEqual(await fetchWorkouts('user-a', 'token', optionsFor([])), [])
  const data = await fetchWorkouts('user-a', 'token', optionsFor([
    row({ id: 'old', date: '2026-01-01', name: null }), row(),
  ]))
  assert.deepEqual(data.map((workout) => workout.id), ['w1', 'old'])
  assert.equal(data[1].name, 'Treening')
  assert.equal(data[0].name, 'Jalgade treening')
})

test('fails closed for another user, missing ownership, invalid payloads, dates, or duplicate ids', async () => {
  for (const payload of [
    [row(), row({ id: 'other', user_id: 'user-b' })], [row({ user_id: undefined })],
    {}, [null], [row({ date: '2026-02-30' })], [row({ name: {} })], [row(), row()],
  ]) {
    await assert.rejects(fetchWorkouts('user-a', 'token', optionsFor(payload)), /ootamatud/)
  }
})

test('missing credentials or API configuration make no network request', async () => {
  let calls = 0
  const options = { baseUrl, fetcher: async () => { calls++; return Response.json([]) } }
  await assert.rejects(fetchWorkouts('', 'token', options), (error) => error.status === 401)
  await assert.rejects(fetchWorkouts('user-a', '', options), (error) => error.status === 401)
  await assert.rejects(apiGet('/workouts', 'token', { ...options, baseUrl: '' }), /pole seadistatud/)
  await assert.rejects(apiGet('/workouts', 'token', { ...options, baseUrl: 'invalid' }), /vigane/)
  assert.equal(calls, 0)
})

test('HTTP and malformed response errors do not reveal backend details', async () => {
  for (const status of [401, 403, 500]) {
    await assert.rejects(fetchWorkouts('user-a', 'token', optionsFor({ error: 'private database detail' }, status)),
      (error) => error instanceof ApiError && error.status === status && !error.message.includes('private'))
  }
  await assert.rejects(fetchWorkouts('user-a', 'token', {
    baseUrl, fetcher: async () => new Response('not json'),
  }), /pole loetav/)
})

test('request lifecycle publishes loading, success, unauthorized, and safe network errors', async () => {
  for (const [options, expected] of [
    [optionsFor([row()]), 'success'], [optionsFor([], 401), 'unauthenticated'],
    [{ baseUrl, fetcher: async () => { throw new TypeError('private network detail') } }, 'error'],
  ]) {
    const states = []
    const cancel = startWorkoutsRequest('user-a', 'token', (state) => states.push(state), options)
    await tick()
    assert.equal(states[0].status, 'loading')
    assert.equal(states.at(-1).status, expected)
    assert.ok(!JSON.stringify(states).includes('private network detail'))
    cancel()
  }
})

test('cancelled account request cannot publish stale data even if fetch ignores abort', async () => {
  let finish
  let signal
  const states = []
  const cancel = startWorkoutsRequest('user-a', 'token-a', (state) => states.push(state), {
    baseUrl, fetcher: (_url, options) => {
      signal = options.signal
      return new Promise((resolve) => { finish = resolve })
    },
  })
  cancel()
  assert.equal(signal.aborted, true)
  finish(Response.json([row()]))
  await tick()
  assert.deepEqual(states, [{ status: 'loading' }])
})

test('content renders loading, empty, success, unauthenticated, and retry states', () => {
  const render = (state) => renderToStaticMarkup(createElement(WorkoutsContent, {
    state, onRetry: () => {}, onLogin: () => {},
  }))
  assert.match(render({ status: 'loading' }), /Laadin treeninguid/)
  assert.match(render({ status: 'success', workouts: [] }), /pole veel salvestatud/)
  const success = render({ status: 'success', workouts: [{ id: 'w1', name: '<script>', date: '2026-11-18' }] })
  assert.match(success, /&lt;script&gt;/)
  assert.match(success, /18\. november 2026/)
  assert.match(success, /dateTime="2026-11-18"/)
  assert.match(success, /detailvaade pole veel saadaval/)
  assert.ok(!success.includes('href='))
  assert.match(render({ status: 'unauthenticated', message: 'Logi sisse.' }), /Logi uuesti sisse/)
  assert.match(render({ status: 'error', message: 'Viga.' }), /Proovi uuesti/)
})
