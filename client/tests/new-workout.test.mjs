import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
after(() => server.close())
const {
  validateWorkout, hasWorkoutErrors, workoutBody, createWorkout, createWorkoutSubmitter,
  fetchExerciseOptions, creationErrorMessage,
} = await server.ssrLoadModule('/src/lib/new-workout.ts')
const { fetchWorkouts } = await server.ssrLoadModule('/src/lib/workouts.ts')
const { resolveRoute } = await server.ssrLoadModule('/src/lib/routes.ts')
const exercises = [{ id: 'ex1', name: 'Kükk' }]
const draft = () => ({ name: ' Jalgade treening ', date: '2026-11-18', sets: [{ exerciseId: 'ex1', weight: '20,5', reps: '10' }] })
const baseUrl = 'http://localhost:3001'
const saved = { id: 'w1', user_id: 'u1', date: '2026-11-18', name: 'Jalgade treening' }
const responseOptions = (payload, status = 201) => ({ baseUrl, fetcher: async () => Response.json(payload, { status }) })

test('requires name, date, a real calendar date, and at least one valid set', () => {
  const empty = validateWorkout({ name: ' ', date: '', sets: [] }, exercises)
  assert.ok(empty.name && empty.date && empty.sets)
  for (const date of ['2026-02-30', '2025-02-29', '18/11/2026', 'invalid']) {
    assert.ok(validateWorkout({ ...draft(), date }, exercises).date)
  }
  assert.equal(hasWorkoutErrors(validateWorkout(draft(), exercises)), false)
  assert.equal(hasWorkoutErrors(validateWorkout({ ...draft(), date: '2024-02-29' }, exercises)), false)
  const invalid = { ...draft(), sets: [{ exerciseId: 'other', weight: '-1', reps: '1.5' }] }
  assert.deepEqual(Object.keys(validateWorkout(invalid, exercises).rows[0]).sort(), ['exerciseId', 'reps', 'weight'])
  for (const weight of ['', 'NaN', 'Infinity']) {
    assert.ok(validateWorkout({ ...draft(), sets: [{ ...draft().sets[0], weight }] }, exercises).rows[0].weight)
  }
})

test('builds the inspected backend contract with numeric sets and trusted exercise names', () => {
  const body = workoutBody(draft(), exercises)
  assert.deepEqual(body, {
    name: 'Jalgade treening', date: '2026-11-18',
    sets: [{ exercise_id: 'ex1', exercise_name: 'Kükk', weight: 20.5, reps: 10 }],
  })
  assert.throws(() => workoutBody({ ...draft(), name: '' }, exercises), /Kontrolli/)
})

test('POST sends JSON and bearer auth; subsequent fresh GET includes the created workout', async () => {
  const requests = []
  const options = { baseUrl, fetcher: async (url, init) => {
    requests.push({ url: String(url), ...init })
    return init.method === 'POST' ? Response.json(saved, { status: 201 }) : Response.json([saved])
  } }
  const body = workoutBody(draft(), exercises)
  assert.equal(await createWorkout('u1', 'test-token', body, options), 'w1')
  assert.deepEqual((await fetchWorkouts('u1', 'test-token', options)).map((item) => item.id), ['w1'])
  assert.equal(requests[0].url, `${baseUrl}/workouts`)
  assert.equal(requests[0].headers.Authorization, 'Bearer test-token')
  assert.equal(requests[0].headers['Content-Type'], 'application/json')
  assert.deepEqual(JSON.parse(requests[0].body), body)
  assert.equal(requests[1].method, 'GET')
  assert.equal(requests[1].cache, 'no-store')
})

test('duplicate pending submissions and repeated successful submissions send only one POST', async () => {
  const submit = createWorkoutSubmitter()
  let calls = 0
  let finish
  const options = { baseUrl, fetcher: async () => {
    calls++
    return new Promise((resolve) => { finish = resolve })
  } }
  const body = workoutBody(draft(), exercises)
  const first = submit('u1', 'token', body, options)
  assert.equal(await submit('u1', 'token', body, options), null)
  finish(Response.json(saved, { status: 201 }))
  assert.equal(await first, 'w1')
  assert.equal(await submit('u1', 'token', body, options), null)
  assert.equal(calls, 1)
})

test('failed submission unlocks for an explicit retry; no automatic retries occur', async () => {
  const submit = createWorkoutSubmitter()
  const body = workoutBody(draft(), exercises)
  let calls = 0
  const options = { baseUrl, fetcher: async () => {
    calls++
    return calls === 1 ? Response.json({ error: 'private detail' }, { status: 400 }) : Response.json(saved, { status: 201 })
  } }
  await assert.rejects(submit('u1', 'token', body, options), (error) => !error.message.includes('private'))
  assert.equal(calls, 1)
  assert.equal(await submit('u1', 'token', body, options), 'w1')
  assert.equal(calls, 2)
})

test('missing configuration, expired sessions, invalid responses, and network errors never simulate success', async () => {
  const body = workoutBody(draft(), exercises)
  await assert.rejects(createWorkout('u1', '', body, responseOptions(saved)), (error) => error.status === 401)
  await assert.rejects(createWorkout('u1', 'token', body, { ...responseOptions(saved), baseUrl: '' }), /pole seadistatud/)
  await assert.rejects(createWorkout('u1', 'token', body, responseOptions({}, 401)), (error) => error.status === 401)
  await assert.rejects(createWorkout('u1', 'token', body, responseOptions({ ...saved, user_id: 'other' })), /ei saanud kinnitada/)
  const message = creationErrorMessage(new TypeError('private detail'))
  assert.match(message, /tulemus pole teada/)
  assert.ok(!message.includes('private detail'))
})

test('exercise dropdown accepts only global/current-user exercises and uses authenticated GET', async () => {
  const rows = [{ id: 'ex1', name: 'Kükk', user_id: null }, { id: 'ex2', name: 'Surumine', user_id: 'u1' }]
  assert.deepEqual(await fetchExerciseOptions('u1', 'token', responseOptions(rows, 200)), [
    { id: 'ex1', name: 'Kükk' }, { id: 'ex2', name: 'Surumine' },
  ])
  await assert.rejects(fetchExerciseOptions('u1', 'token', responseOptions([{ ...rows[0], user_id: 'other' }], 200)), /ootamatud/)
})

test('new-workout URL stays protected and the form renders accessible required fields', async () => {
  assert.equal(resolveRoute('/workouts/new', { loading: false, authenticated: false }).kind, 'redirect')
  assert.equal(resolveRoute('/workouts/new', { loading: true, authenticated: true }).kind, 'loading')
  const { AuthContext } = await server.ssrLoadModule('/src/context/AuthContext.tsx')
  const { default: NewWorkoutPage } = await server.ssrLoadModule('/src/pages/NewWorkoutPage.tsx')
  const user = { id: 'u1' }
  const html = renderToStaticMarkup(createElement(AuthContext.Provider, { value: {
    user, session: { user, access_token: 'test-token' }, loading: false, configurationError: null, error: null,
    signOut: async () => {},
  } }, createElement(NewWorkoutPage, { navigate: () => {} })))
  assert.match(html, /for="workout-name"/)
  assert.match(html, /for="workout-date"/)
  assert.match(html, /type="date" required/)
  assert.match(html, /Lisa seeria/)
  assert.match(html, /Salvesta treening/)
  assert.match(html, /type="submit" disabled/)
})
