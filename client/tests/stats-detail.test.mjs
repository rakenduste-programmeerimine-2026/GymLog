import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { setImmediate as tick } from 'node:timers/promises'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
after(() => server.close())
const { fetchStatsDetail, parseStatsDetail, startStatsDetailRequest } = await server.ssrLoadModule('/src/lib/stats-detail.ts')
const { default: StatsDetailContent } = await server.ssrLoadModule('/src/components/StatsDetailContent.tsx')
const { AppRoutes } = await server.ssrLoadModule('/src/App.tsx')
const { AuthContext } = await server.ssrLoadModule('/src/context/AuthContext.tsx')
const baseUrl = 'http://localhost:3001'
const raw = (overrides = {}) => ({
  workoutId: 'w1', name: 'Jalapäev', date: '2026-11-18', totalVolume: 250,
  exerciseTrends: { Kükk: [{ date: '2026-11-18', weight: 25, reps: 10 }] },
  comparison: { previousWorkoutId: 'w0', previousDate: '2026-11-11', previousVolume: 200, volumeDifference: 50 },
  ...overrides,
})
const opts = (payload, status = 200) => ({ baseUrl, fetcher: async () => Response.json(payload, { status }) })

test('uses actual /stats/detail/:workoutId route with bearer auth and no invented query', async () => {
  let request
  const stats = await fetchStatsDetail('u1', 'test-token', 'w1', { baseUrl, fetcher: async (url, options) => {
    request = { url: String(url), ...options }
    return Response.json(raw())
  } })
  assert.equal(request.url, `${baseUrl}/stats/detail/w1`)
  assert.equal(request.headers.Authorization, 'Bearer test-token')
  assert.equal(request.method, 'GET')
  assert.equal(request.cache, 'no-store')
  assert.equal(stats.totalVolume, 250)
  assert.equal(stats.comparison.volumeDifference, 50)
})

test('empty trends, zero volume, and null comparison are valid, distinct from malformed data', () => {
  const stats = parseStatsDetail(raw({ totalVolume: 0, exerciseTrends: {}, comparison: null }), 'w1')
  assert.deepEqual(stats.exerciseTrends, [])
  const html = renderToStaticMarkup(createElement(StatsDetailContent, { stats }))
  assert.match(html, /0 kg × kordust/)
  assert.match(html, /ajaloo andmed puuduvad/)
  assert.match(html, /võrdlemiseks ei ole/)
})

test('preserves multiple rows per day, missing values, and supplied negative/zero comparisons', () => {
  for (const difference of [-50, 0]) {
    const stats = parseStatsDetail(raw({ comparison: { previousWorkoutId: 'w0', previousDate: '2026-11-11',
      previousVolume: 250 - difference, volumeDifference: difference },
    exerciseTrends: { Kükk: [
      { date: '2026-11-18', weight: null, reps: null },
      { date: '2026-11-01', weight: 0, reps: 0 },
      { date: '2026-11-18', weight: 25.5, reps: 8 },
    ] } }), 'w1')
    assert.equal(stats.exerciseTrends[0].points.length, 3)
    assert.equal(stats.exerciseTrends[0].points[0].date, '2026-11-01')
    assert.equal(stats.comparison.volumeDifference, difference)
    const html = renderToStaticMarkup(createElement(StatsDetailContent, { stats }))
    assert.match(html, /Andmed puuduvad/)
    assert.match(html, /25,5/)
  }
})

test('rejects mismatched workouts, malformed numbers/dates/trends, and invalid comparisons', () => {
  for (const payload of [raw({ workoutId: 'other' }), raw({ totalVolume: '250' }), raw({ totalVolume: -1 }),
    raw({ date: '2026-02-30' }), raw({ exerciseTrends: [] }), raw({ exerciseTrends: { Kükk: {} } }),
    raw({ exerciseTrends: { Kükk: [{ date: '2026-11-18', weight: -1, reps: 8 }] } }),
    raw({ comparison: { previousWorkoutId: 'w1', previousDate: '2026-11-18', previousVolume: 100, volumeDifference: 150 } })]) {
    assert.throws(() => parseStatsDetail(payload, 'w1'), /ootamatud/)
  }
})

test('invalid IDs and missing user/token/API configuration never fetch anonymously', async () => {
  let calls = 0
  const options = { baseUrl, fetcher: async () => { calls++; return Response.json(raw()) } }
  await assert.rejects(fetchStatsDetail('', 'token', 'w1', options), (error) => error.status === 401)
  await assert.rejects(fetchStatsDetail('u1', '', 'w1', options), (error) => error.status === 401)
  await assert.rejects(fetchStatsDetail('u1', 'token', '../w1', options), /ID on vigane/)
  await assert.rejects(fetchStatsDetail('u1', 'token', 'w1', { ...options, baseUrl: '' }), /pole seadistatud/)
  assert.equal(calls, 0)
})

test('request states handle loading, expired session, not-found, API/network errors safely', async () => {
  for (const [options, status] of [
    [opts(raw()), 'success'], [opts({ error: 'private detail' }, 401), 'unauthenticated'],
    [opts({ error: 'private detail' }, 404), 'not-found'], [opts({ error: 'private detail' }, 500), 'error'],
    [{ baseUrl, fetcher: async () => { throw new TypeError('private detail') } }, 'error'],
  ]) {
    const states = []
    const cancel = startStatsDetailRequest('u1', 'token', 'w1', (state) => states.push(state), options)
    await tick()
    assert.equal(states[0].status, 'loading')
    assert.equal(states.at(-1).status, status)
    assert.ok(!JSON.stringify(states).includes('private detail'))
    cancel()
  }
})

test('cancelled account/workout requests never publish stale statistics', async () => {
  const states = []
  let finish
  let signal
  const cancel = startStatsDetailRequest('u1', 'token-a', 'w1', (state) => states.push(state), {
    baseUrl, fetcher: (_url, options) => { signal = options.signal; return new Promise((resolve) => { finish = resolve }) },
  })
  cancel(); finish(Response.json(raw())); await tick()
  assert.equal(signal.aborted, true)
  assert.deepEqual(states, [{ status: 'loading' }])
})

test('tables have captions/headers, escaped names, units, and comparison without invented percentages', () => {
  const stats = parseStatsDetail(raw({ exerciseTrends: { '<script>': [
    { date: '2026-11-18', weight: 25, reps: 10 },
  ], Tühi: [] } }), 'w1')
  const html = renderToStaticMarkup(createElement(StatsDetailContent, { stats }))
  assert.match(html, /<caption>&lt;script&gt;<\/caption>/)
  assert.match(html, /scope="col"/)
  assert.match(html, /scope="row"/)
  assert.match(html, /Selle harjutuse ajalugu puudub/)
  assert.match(html, /\+50 kg × kordust/)
  assert.ok(!html.includes('%'))
})

test('detail remains protected, waits for auth, and links back to calendar for signed-in users', () => {
  const render = (auth) => renderToStaticMarkup(createElement(AuthContext.Provider, { value: {
    user: null, session: null, loading: false, configurationError: null, error: null,
    signOut: async () => {}, ...auth,
  } }, createElement(AppRoutes, { path: '/stats/detail/w1', navigate: () => {} })))
  assert.match(render({}), /Suunan edasi/)
  assert.match(render({ loading: true }), /Laadin sessiooni/)
  const user = { id: 'u1' }
  const html = render({ user, session: { user, access_token: 'test-token' } })
  assert.match(html, /Detailne statistika/)
  assert.match(html, /href="\/stats"/)
  assert.match(html, /Laadin treeninguid/)
})
