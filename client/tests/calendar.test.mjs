import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { setImmediate as tick } from 'node:timers/promises'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
after(() => server.close())
const {
  localToday, validMonth, monthDates, shiftMonth, calendarWeeks, monthLabel, fetchCalendar, startCalendarRequest,
} = await server.ssrLoadModule('/src/lib/calendar.ts')
const { default: WorkoutCalendar } = await server.ssrLoadModule('/src/components/WorkoutCalendar.tsx')
const { CalendarContent } = await server.ssrLoadModule('/src/pages/StatsCalendarPage.tsx')
const baseUrl = 'http://localhost:3001'
const activity = (month, marked = []) => Object.fromEntries(monthDates(month).map((date) => [date, marked.includes(date)]))
const opts = (payload, status = 200) => ({ baseUrl, fetcher: async () => Response.json(payload, { status }) })

test('month navigation crosses year boundaries and respects supported bounds', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01')
  assert.equal(shiftMonth('2026-01', -1), '2025-12')
  assert.equal(shiftMonth('1000-01', -1), null)
  assert.equal(shiftMonth('9999-12', 1), null)
  for (const month of ['2026-00', '2026-13', '26-11', '2026-1', '0000-01']) assert.equal(validMonth(month), false)
})

test('date generation handles leap years, century rules, and month lengths', () => {
  assert.equal(monthDates('2024-02').length, 29)
  assert.equal(monthDates('2025-02').length, 28)
  assert.equal(monthDates('2000-02').length, 29)
  assert.equal(monthDates('2100-02').length, 28)
  assert.equal(monthDates('2026-04').at(-1), '2026-04-30')
  assert.equal(monthDates('2026-12').at(-1), '2026-12-31')
  assert.equal(localToday(new Date(2026, 0, 1, 0, 1)), '2026-01-01')
  assert.match(monthLabel('2026-11'), /november 2026/)
})

test('calendar weeks start on Monday and contain each date exactly once', () => {
  assert.equal(calendarWeeks('2024-01')[0][0], '2024-01-01')
  assert.deepEqual(calendarWeeks('2026-11')[0], [null, null, null, null, null, null, '2026-11-01'])
  for (const month of ['2024-02', '2026-11', '2026-12']) {
    const weeks = calendarWeeks(month)
    assert.ok(weeks.every((week) => week.length === 7))
    assert.deepEqual(weeks.flat().filter(Boolean), monthDates(month))
  }
})

test('GET uses the exact backend month query and bearer token and parses boolean date map', async () => {
  let request
  const payload = activity('2026-11', ['2026-11-18'])
  const result = await fetchCalendar('u1', 'test-token', '2026-11', { baseUrl, fetcher: async (url, options) => {
    request = { url: String(url), ...options }
    return Response.json(payload)
  } })
  assert.equal(request.url, `${baseUrl}/stats/calendar?month=2026-11`)
  assert.equal(request.headers.Authorization, 'Bearer test-token')
  assert.equal(request.cache, 'no-store')
  assert.equal(request.method, 'GET')
  assert.deepEqual(result, payload)
})

test('rejects wrong months, missing dates, extra dates, and non-boolean values rather than showing false empty data', async () => {
  const correct = activity('2026-11')
  const missing = { ...correct }; delete missing['2026-11-18']
  for (const payload of [{}, [], null, missing, activity('2026-12'),
    { ...correct, '2026-11-31': true }, { ...correct, '2026-11-18': 'true' }]) {
    await assert.rejects(fetchCalendar('u1', 'token', '2026-11', opts(payload)), /ootamatud/)
  }
})

test('invalid month and missing user/token/config never trigger anonymous requests', async () => {
  let calls = 0
  const options = { baseUrl, fetcher: async () => { calls++; return Response.json(activity('2026-11')) } }
  await assert.rejects(fetchCalendar('', 'token', '2026-11', options), (error) => error.status === 401)
  await assert.rejects(fetchCalendar('u1', '', '2026-11', options), (error) => error.status === 401)
  await assert.rejects(fetchCalendar('u1', 'token', '2026-13', options), /kuu on vigane/)
  await assert.rejects(fetchCalendar('u1', 'token', '2026-11', { ...options, baseUrl: '' }), /pole seadistatud/)
  assert.equal(calls, 0)
})

test('request lifecycle distinguishes success, expired session, API errors, and network failures', async () => {
  for (const [options, expected] of [
    [opts(activity('2026-11')), 'success'], [opts({ error: 'private detail' }, 401), 'unauthenticated'],
    [opts({ error: 'private detail' }, 500), 'error'],
    [{ baseUrl, fetcher: async () => { throw new TypeError('private detail') } }, 'error'],
  ]) {
    const states = []
    const cancel = startCalendarRequest('u1', 'token', '2026-11', (state) => states.push(state), options)
    await tick()
    assert.equal(states[0].status, 'loading')
    assert.equal(states.at(-1).status, expected)
    assert.ok(!JSON.stringify(states).includes('private detail'))
    cancel()
  }
})

test('cancelled month/account request cannot publish stale activity even if fetch ignores abort', async () => {
  let finish
  let signal
  const states = []
  const cancel = startCalendarRequest('u1', 'token-a', '2026-11', (state) => states.push(state), {
    baseUrl, fetcher: (_url, options) => { signal = options.signal; return new Promise((resolve) => { finish = resolve }) },
  })
  cancel(); finish(Response.json(activity('2026-11', ['2026-11-18']))); await tick()
  assert.equal(signal.aborted, true)
  assert.deepEqual(states, [{ status: 'loading' }])
})

test('calendar markup exposes Estonian dates, today, selected state, and non-color workout markers', () => {
  const html = renderToStaticMarkup(createElement(WorkoutCalendar, {
    month: '2026-11', activity: activity('2026-11', ['2026-11-18']), today: '2026-11-18',
    selected: '2026-11-18', onSelect: () => {},
  }))
  assert.match(html, /aria-current="date"/)
  assert.match(html, /aria-pressed="true"/)
  assert.match(html, /18\. november 2026, täna, treeninguga päev/)
  assert.match(html, /title="Esmaspäev"/)
  assert.match(html, /●/)
  assert.match(html, /sel päeval on treening salvestatud/)
})

test('empty month still renders calendar and error/loading states do not pretend to be empty', () => {
  const render = (state) => renderToStaticMarkup(createElement(CalendarContent, {
    state, month: '2026-11', today: '2026-11-18', selected: '2026-11-18',
    onSelect: () => {}, onRetry: () => {}, onLogin: () => {},
  }))
  const empty = render({ status: 'success', activity: activity('2026-11') })
  assert.match(empty, /Sel kuul pole treeninguid/)
  assert.match(empty, /<table/)
  assert.match(empty, /sel päeval pole treeninguid/)
  assert.match(render({ status: 'loading' }), /Laadin kalendrit/)
  assert.match(render({ status: 'unauthenticated', message: 'Sessioon aegunud' }), /Logi uuesti sisse/)
  const error = render({ status: 'error', message: 'Viga' })
  assert.match(error, /Proovi uuesti/)
  assert.ok(!error.includes('Sel kuul pole treeninguid'))
})
