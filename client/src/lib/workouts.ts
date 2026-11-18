import { ApiError, apiGet } from './api'
import type { ApiOptions } from './api'

export interface WorkoutSummary {
  id: string
  name: string
  date: string
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export async function fetchWorkouts(userId: string, token: string, options?: ApiOptions): Promise<WorkoutSummary[]> {
  if (!userId) throw new ApiError('Sisselogimine on vajalik.', 401)
  const payload = await apiGet('/workouts', token, options)
  if (!Array.isArray(payload)) throw new ApiError('Server tagastas ootamatud treeninguandmed.')
  const ids = new Set<string>()
  const workouts = payload.map((item: unknown): WorkoutSummary => {
    if (!item || typeof item !== 'object') throw new ApiError('Server tagastas ootamatud treeninguandmed.')
    const row = item as Record<string, unknown>
    // Fail closed if ownership is absent or belongs to anyone else.
    if (row.user_id !== userId || typeof row.id !== 'string' || !row.id || ids.has(row.id)
      || !validDate(row.date) || (row.name != null && typeof row.name !== 'string')) {
      throw new ApiError('Server tagastas ootamatud treeninguandmed.')
    }
    ids.add(row.id)
    return { id: row.id, name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : 'Treening', date: row.date }
  })
  return workouts.sort((a, b) => b.date.localeCompare(a.date))
}

export function formatWorkoutDate(date: string): string {
  return new Intl.DateTimeFormat('et-EE', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))
}

export function workoutsErrorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Ühendus serveriga ebaõnnestus. Kontrolli internetiühendust ja proovi uuesti.'
}

export type WorkoutsState =
  | { status: 'loading' }
  | { status: 'success'; workouts: WorkoutSummary[] }
  | { status: 'unauthenticated'; message: string }
  | { status: 'error'; message: string }

// Cancelled or superseded requests must never publish data to the current view.
export function startWorkoutsRequest(
  userId: string, token: string, publish: (state: WorkoutsState) => void,
  options: Omit<ApiOptions, 'signal'> = {},
): () => void {
  const controller = new AbortController()
  let active = true
  publish({ status: 'loading' })
  void fetchWorkouts(userId, token, { ...options, signal: controller.signal }).then((workouts) => {
    if (active) publish({ status: 'success', workouts })
  }).catch((error: unknown) => {
    if (!active || controller.signal.aborted) return
    publish({
      status: error instanceof ApiError && error.status === 401 ? 'unauthenticated' : 'error',
      message: workoutsErrorMessage(error),
    })
  })
  return () => { active = false; controller.abort() }
}
