import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { setImmediate as tick } from 'node:timers/promises'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
after(() => server.close())
const {
  fetchExercises, createExercise, validateExercise, createExerciseSubmitter,
  startExercisesRequest, exerciseErrorMessage,
} = await server.ssrLoadModule('/src/lib/exercises.ts')
const { ExercisesContent, default: ExercisesPage } = await server.ssrLoadModule('/src/pages/ExercisesPage.tsx')
const baseUrl = 'http://localhost:3001'
const shared = { id: 'e1', name: 'Kükk', category: 'Jalad', user_id: null }
const personal = { id: 'e2', name: 'Surumine', category: null, user_id: 'u1' }
const optionsFor = (value, status = 200) => ({ baseUrl, fetcher: async () => Response.json(value, { status }) })

test('GET uses bearer auth and displays shared plus own exercises with category and visibility', async () => {
  let request
  const exercises = await fetchExercises('u1', 'test-token', { baseUrl, fetcher: async (url, options) => {
    request = { url: String(url), ...options }
    return Response.json([personal, shared])
  } })
  assert.equal(request.url, `${baseUrl}/exercises`)
  assert.equal(request.method, 'GET')
  assert.equal(request.headers.Authorization, 'Bearer test-token')
  assert.deepEqual(exercises.map((item) => item.name), ['Kükk', 'Surumine'])
  assert.deepEqual(exercises.map((item) => item.shared), [true, false])
  const html = renderToStaticMarkup(createElement(ExercisesContent, {
    state: { status: 'success', exercises }, onRetry: () => {}, onLogin: () => {},
  }))
  for (const text of ['Ühine harjutus', 'Minu harjutus', 'Jalad', 'Määramata']) assert.ok(html.includes(text))
})

test('fails closed for other users, missing ownership, duplicate IDs, and malformed fields', async () => {
  for (const payload of [[shared, { ...personal, user_id: 'someone-else' }], [{ ...personal, user_id: undefined }],
    [shared, shared], {}, [null], [{ ...personal, name: ' ' }], [{ ...personal, category: {} }]]) {
    await assert.rejects(fetchExercises('u1', 'token', optionsFor(payload)), /ootamatud/)
  }
  assert.deepEqual(await fetchExercises('u1', 'token', optionsFor([])), [])
})

test('name is required, trimmed, and category remains optional without invented constraints', () => {
  assert.ok(validateExercise({ name: ' ', category: 'Jalad' }).name)
  assert.deepEqual(validateExercise({ name: ' Kükk ', category: '' }), {})
})

test('POST sends only documented name/category and refresh GET contains the saved personal exercise', async () => {
  const requests = []
  const options = { baseUrl, fetcher: async (url, init) => {
    requests.push({ url: String(url), ...init })
    return init.method === 'POST' ? Response.json(personal, { status: 201 }) : Response.json([shared, personal])
  } }
  const exercise = await createExercise('u1', 'test-token', { name: ' Surumine ', category: '' }, options)
  assert.equal(exercise.shared, false)
  assert.deepEqual(JSON.parse(requests[0].body), { name: 'Surumine' })
  assert.equal(requests[0].headers.Authorization, 'Bearer test-token')
  assert.equal(requests[0].headers['Content-Type'], 'application/json')
  assert.equal(requests[0].url, `${baseUrl}/exercises`)
  const refreshed = await fetchExercises('u1', 'test-token', options)
  assert.ok(refreshed.some((item) => item.id === exercise.id))
  assert.equal(requests[1].method, 'GET')
  assert.equal(requests[1].cache, 'no-store')
  let body
  await createExercise('u1', 'token', { name: ' Surumine ', category: ' Ülakeha ' }, {
    baseUrl, fetcher: async (_url, init) => { body = JSON.parse(init.body); return Response.json(personal, { status: 201 }) },
  })
  assert.deepEqual(body, { name: 'Surumine', category: 'Ülakeha' })
})

test('validation/missing credentials/configuration do not send requests; creation never accepts a shared/foreign record', async () => {
  const draft = { name: 'Kükk', category: '' }
  let calls = 0
  const options = { baseUrl, fetcher: async () => { calls++; return Response.json(personal, { status: 201 }) } }
  await assert.rejects(createExercise('u1', 'token', { ...draft, name: ' ' }, options), /Sisesta/)
  await assert.rejects(createExercise('', 'token', draft, options), (error) => error.status === 401)
  await assert.rejects(createExercise('u1', '', draft, options), (error) => error.status === 401)
  await assert.rejects(createExercise('u1', 'token', draft, { ...options, baseUrl: '' }), /pole seadistatud/)
  assert.equal(calls, 0)
  await assert.rejects(createExercise('u1', 'token', draft, optionsFor(shared, 201)), /ei saanud kinnitada/)
  await assert.rejects(createExercise('u1', 'token', draft, optionsFor({ ...personal, user_id: 'other' }, 201)), /ootamatud/)
})

test('duplicate in-flight submissions send one POST and failures unlock explicit retry', async () => {
  const submit = createExerciseSubmitter()
  const draft = { name: 'Surumine', category: '' }
  let calls = 0
  let finish
  const options = { baseUrl, fetcher: async () => { calls++; return new Promise((resolve) => { finish = resolve }) } }
  const first = submit('u1', 'token', draft, options)
  assert.equal(await submit('u1', 'token', draft, options), null)
  assert.equal(calls, 1)
  finish(Response.json({ error: 'private details' }, { status: 400 }))
  await assert.rejects(first, (error) => !error.message.includes('private'))
  assert.equal((await submit('u1', 'token', draft, optionsFor(personal, 201))).id, 'e2')
})

test('load lifecycle handles expired sessions, network failures, and cancelled stale results', async () => {
  for (const [options, expected] of [
    [optionsFor([shared]), 'success'], [optionsFor({}, 401), 'unauthenticated'],
    [{ baseUrl, fetcher: async () => { throw new TypeError('private detail') } }, 'error'],
  ]) {
    const states = []
    const cancel = startExercisesRequest('u1', 'token', (state) => states.push(state), options)
    await tick()
    assert.equal(states[0].status, 'loading')
    assert.equal(states.at(-1).status, expected)
    assert.ok(!JSON.stringify(states).includes('private detail'))
    cancel()
  }
  let finish
  let signal
  const states = []
  const cancel = startExercisesRequest('u1', 'token', (state) => states.push(state), {
    baseUrl, fetcher: (_url, init) => { signal = init.signal; return new Promise((resolve) => { finish = resolve }) },
  })
  cancel(); finish(Response.json([personal])); await tick()
  assert.equal(signal.aborted, true)
  assert.deepEqual(states, [{ status: 'loading' }])
  assert.match(exerciseErrorMessage(new TypeError('secret'), true), /tulemus pole teada/)
})

test('creation errors keep useful safe messages, including expired sessions', async () => {
  for (const status of [400, 401, 403, 500]) {
    await assert.rejects(createExercise('u1', 'token', { name: 'Kükk', category: '' }, optionsFor({ error: 'private detail' }, status)),
      (error) => error.status === status && !exerciseErrorMessage(error, true).includes('private detail'))
  }
})

test('empty/error/loading feedback and accessible form render without live credentials', async () => {
  const render = (state) => renderToStaticMarkup(createElement(ExercisesContent, { state, onRetry: () => {}, onLogin: () => {} }))
  assert.match(render({ status: 'loading' }), /Laadin harjutusi/)
  assert.match(render({ status: 'success', exercises: [] }), /Harjutusi pole veel/)
  assert.match(render({ status: 'error', message: 'Viga' }), /Proovi uuesti/)
  assert.match(render({ status: 'unauthenticated', message: 'Sessioon aegunud' }), /Logi uuesti sisse/)
  const { AuthContext } = await server.ssrLoadModule('/src/context/AuthContext.tsx')
  const user = { id: 'u1' }
  const html = renderToStaticMarkup(createElement(AuthContext.Provider, { value: {
    user, session: { user, access_token: 'test-token' }, loading: false, configurationError: null, error: null,
    signOut: async () => {},
  } }, createElement(ExercisesPage, { navigate: () => {} })))
  assert.match(html, /for="exercise-name"/)
  const nameInput = html.match(/<input[^>]*id="exercise-name"[^>]*>/)?.[0] ?? ''
  assert.match(nameInput, /name="name"/)
  assert.match(nameInput, /required/)
  assert.match(html, /Kategooria \(valikuline\)/)
  assert.match(html, /Lisa harjutus/)
})
