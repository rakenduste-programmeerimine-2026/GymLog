import { ApiError, apiGet } from './api'
import type { ApiOptions } from './api'

export type CalendarActivity = Record<string, boolean>
const pad = (value: number) => String(value).padStart(2, '0')

export function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function validMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Number(month.slice(0, 4)) >= 1000
}

export function monthDates(month: string): string[] {
  if (!validMonth(month)) throw new ApiError('Kalendri kuu on vigane.')
  const [year, monthNumber] = month.split('-').map(Number)
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return Array.from({ length: days }, (_, index) => `${month}-${pad(index + 1)}`)
}

export function shiftMonth(month: string, delta: -1 | 1): string | null {
  if (!validMonth(month)) return null
  const [year, number] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, number - 1 + delta, 1))
  const next = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`
  return validMonth(next) ? next : null
}

export function calendarWeeks(month: string): (string | null)[][] {
  const dates = monthDates(month)
  const offset = (new Date(`${dates[0]}T12:00:00Z`).getUTCDay() + 6) % 7
  const cells: (string | null)[] = [...Array(offset).fill(null), ...dates]
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, row) => cells.slice(row * 7, row * 7 + 7))
}

export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat('et-EE', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T12:00:00Z`))
}

export async function fetchCalendar(userId: string, token: string, month: string, options?: ApiOptions): Promise<CalendarActivity> {
  if (!userId) throw new ApiError('Sisselogimine on vajalik.', 401)
  const dates = monthDates(month)
  const payload = await apiGet(`/stats/calendar?month=${encodeURIComponent(month)}`, token, options)
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ApiError('Server tagastas ootamatud kalendriandmed.')
  }
  const values = payload as Record<string, unknown>
  if (Object.keys(values).length !== dates.length || dates.some((date) => typeof values[date] !== 'boolean')) {
    throw new ApiError('Server tagastas ootamatud kalendriandmed.')
  }
  return Object.fromEntries(dates.map((date) => [date, values[date] as boolean]))
}

export type CalendarState =
  | { status: 'loading' }
  | { status: 'success'; activity: CalendarActivity }
  | { status: 'error' | 'unauthenticated'; message: string }

export function startCalendarRequest(userId: string, token: string, month: string,
  publish: (state: CalendarState) => void, options: Omit<ApiOptions, 'signal'> = {}): () => void {
  const controller = new AbortController()
  let active = true
  publish({ status: 'loading' })
  void fetchCalendar(userId, token, month, { ...options, signal: controller.signal }).then((activity) => {
    if (active) publish({ status: 'success', activity })
  }).catch((error: unknown) => {
    if (active && !controller.signal.aborted) publish({
      status: error instanceof ApiError && error.status === 401 ? 'unauthenticated' : 'error',
      message: error instanceof ApiError ? error.message : 'Kalendrit ei saanud laadida. Kontrolli internetiühendust ja proovi uuesti.',
    })
  })
  return () => { active = false; controller.abort() }
}
