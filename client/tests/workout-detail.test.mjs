import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { setImmediate as tick } from 'node:timers/promises'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
after(() => server.close())
const {
  validWorkoutId, fetchWorkoutDetail, updateWorkoutDetail, deleteWorkoutDetail,
  parseWorkoutDetail, detailDraft, editBody, validateWorkoutEdit,
  createDetailActions, startDetailRequest, detailErrorState,
} = await server.ssrLoadModule('/src/lib/workout-detail.ts')
const { resolveRoute } = await server.ssrLoadModule('/src/lib/routes.ts')
const { WorkoutDetailContent } = await server.ssrLoadModule('/src/pages/WorkoutDetailPage.tsx')
const { default: WorkoutEditForm } = await server.ssrLoadModule('/src/components/WorkoutEditForm.tsx')
const baseUrl = 'http://localhost:3001'
const set = (overrides = {}) => ({
  id: 's1', workout_id: 'w1', exercise_id: 'e1', exercise_name: 'Kükk', weight: 25.5, reps: 10, set_order: 1, ...overrides,
})
const raw = (overrides = {}) => ({ id: 'w1', user_id: 'u1', name: 'Jalgade treening', date: '2026-11-18', sets: [set()], ...overrides })
const opts = (value, status = 200) => ({ baseUrl, fetcher: async () => Response.json(value, { status }) })

test('GET detail uses bearer auth and sorts returned sets by set_order', async () => {
  let request
  const workout = await fetchWorkoutDetail('w1', 'u1', 'test-token', {
    baseUrl, fetcher: async (url, options) => {
      request = { url: String(url), ...options }
      return Response.json(raw({ sets: [set({ id: 's2', set_order: 2 }), set()] }))
    },
  })
  assert.equal(request.url, `${baseUrl}/workouts/w1`)
  assert.equal(request.headers.Authorization, 'Bearer test-token')
  assert.deepEqual(workout.sets.map((item) => item.id), ['s1', 's2'])
})

test('rejects malformed IDs before fetching and protects detail routes', async () => {
  let calls = 0
  const options = { baseUrl, fetcher: async () => { calls++; return Response.json(raw()) } }
  for (const id of ['', '../w1', 'w1?x=1', 'w1/other', '%2f', 'new', 'a'.repeat(129)]) {
    assert.equal(validWorkoutId(id), false)
    await assert.rejects(fetchWorkoutDetail(id, 'u1', 'token', options), /ID on vigane/)
    await assert.rejects(deleteWorkoutDetail(id, 'u1', 'token', options), /ID on vigane/)
  }
  assert.equal(calls, 0)
  assert.equal(resolveRoute('/workouts/w1', { loading: false, authenticated: false }).kind, 'redirect')
  assert.equal(resolveRoute('/workouts/w1', { loading: true, authenticated: true }).kind, 'loading')
  assert.equal(resolveRoute('/workouts/w1', { loading: false, authenticated: true }).kind, 'protected')
})

test('never accepts another user, another workout, or malformed/cross-workout sets', () => {
  for (const payload of [raw({ user_id: 'other' }), raw({ id: 'other' }), raw({ date: '2026-02-30' }),
    raw({ sets: [set({ workout_id: 'other' })] }), raw({ sets: [set({ reps: 0 })] }),
    raw({ sets: [set({ weight: -1 })] }), raw({ sets: [set(), set()] }), raw({ sets: null })]) {
    assert.throws(() => parseWorkoutDetail(payload, 'w1', 'u1'), /ootamatud/)
  }
})

test('edit validates name/date and sets and preserves exercise identities in the PUT contract', async () => {
  const original = parseWorkoutDetail(raw(), 'w1', 'u1')
  const draft = detailDraft(original)
  draft.name = ' Muudetud treening '
  draft.sets[0].weight = '30,5'
  draft.sets[0].reps = '8'
  const body = editBody(draft, original)
  assert.deepEqual(body, { name: 'Muudetud treening', date: '2026-11-18', sets: [
    { exercise_id: 'e1', exercise_name: 'Kükk', weight: 30.5, reps: 8 },
  ] })
  const invalid = { ...draft, name: '', date: 'bad', sets: [{ ...draft.sets[0], reps: '1.5' }] }
  const errors = validateWorkoutEdit(invalid, original)
  assert.ok(errors.name && errors.date && errors.rows[0].reps)
  assert.throws(() => editBody(invalid, original), /Kontrolli/)
  let request
  const updated = await updateWorkoutDetail('w1', 'u1', 'token', body, { baseUrl, fetcher: async (url, init) => {
    request = { url: String(url), ...init }
    return Response.json(raw({ name: body.name, sets: [set({ weight: 30.5, reps: 8 })] }))
  } })
  assert.equal(request.method, 'PUT')
  assert.equal(request.headers['Content-Type'], 'application/json')
  assert.deepEqual(JSON.parse(request.body), body)
  assert.equal(updated.sets[0].weight, 30.5)
  const empty = parseWorkoutDetail(raw({ sets: [] }), 'w1', 'u1')
  assert.deepEqual(editBody(detailDraft(empty), empty).sets, [])
})

test('delete supports the actual 204 no-content contract and sends no body', async () => {
  let request
  await deleteWorkoutDetail('w1', 'u1', 'token', { baseUrl, fetcher: async (url, init) => {
    request = { url: String(url), ...init }
    return new Response(null, { status: 204 })
  } })
  assert.equal(request.method, 'DELETE')
  assert.equal(request.headers.Authorization, 'Bearer token')
  assert.equal(request.body, undefined)
})

test('deletion cancellation sends no request, and save/delete share a duplicate-submit lock', async () => {
  const actions = createDetailActions()
  let calls = 0
  assert.equal(await actions.remove(() => false, async () => { calls++ }), false)
  let finish
  const first = actions.save(() => { calls++; return new Promise((resolve) => { finish = resolve }) })
  assert.equal(await actions.save(async () => { calls++; return null }), null)
  assert.equal(await actions.remove(() => true, async () => { calls++ }), false)
  finish(parseWorkoutDetail(raw(), 'w1', 'u1'))
  await first
  assert.equal(await actions.remove(() => true, async () => { calls++ }), true)
  assert.equal(await actions.remove(() => true, async () => { calls++ }), false)
  assert.equal(await actions.save(async () => { calls++; return null }), null)
  assert.equal(calls, 2)
})

test('action failures unlock explicit retry without automatic network retries', async () => {
  const actions = createDetailActions()
  let attempts = 0
  await assert.rejects(actions.remove(() => true, async () => { attempts++; throw new Error('failed') }))
  assert.equal(attempts, 1)
  assert.equal(await actions.remove(() => true, async () => { attempts++ }), true)
  assert.equal(attempts, 2)
})

test('not-found, expired session, missing API config, and network failures are safe', async () => {
  for (const [status, expected] of [[404, 'not-found'], [401, 'unauthenticated'], [500, 'error']]) {
    let failure
    try { await fetchWorkoutDetail('w1', 'u1', 'token', opts({ error: 'private detail' }, status)) } catch (error) { failure = error }
    const state = detailErrorState(failure)
    assert.equal(state.status, expected)
    assert.ok(!state.message.includes('private detail'))
  }
  await assert.rejects(fetchWorkoutDetail('w1', 'u1', 'token', { ...opts(raw()), baseUrl: '' }), /pole seadistatud/)
  await assert.rejects(updateWorkoutDetail('w1', 'u1', '', editBody(detailDraft(parseWorkoutDetail(raw(), 'w1', 'u1')), parseWorkoutDetail(raw(), 'w1', 'u1')), opts(raw())),
    (error) => error.status === 401)
  assert.match(detailErrorState(new TypeError('private detail'), true).message, /tulemus pole teada/)
})

test('cancelled detail request never publishes stale results', async () => {
  const states = []
  let finish
  let signal
  const cancel = startDetailRequest('w1', 'u1', 'token', (state) => states.push(state), {
    baseUrl, fetcher: (_url, options) => {
      signal = options.signal
      return new Promise((resolve) => { finish = resolve })
    },
  })
  cancel()
  finish(Response.json(raw()))
  await tick()
  assert.equal(signal.aborted, true)
  assert.deepEqual(states, [{ status: 'loading' }])
})

test('detail and edit markup show localized data and accessible controls', () => {
  const workout = parseWorkoutDetail(raw({ name: '<script>' }), 'w1', 'u1')
  const html = renderToStaticMarkup(createElement(WorkoutDetailContent, { workout }))
  assert.match(html, /&lt;script&gt;/)
  for (const label of ['Kükk', 'Seeria 1', '25,5 kg', 'Kordused', '18. november 2026']) assert.ok(html.includes(label))
  const edit = renderToStaticMarkup(createElement(WorkoutEditForm, { workout, busy: true, onSave: () => {}, onCancel: () => {} }))
  assert.match(edit, /fieldset disabled/)
  assert.match(edit, /for="edit-name"/)
  assert.match(edit, /for="edit-weight-0"/)
  assert.match(edit, /Salvestan/)
})
