import { ApiError, apiGet } from './api'
import type { ApiOptions } from './api'
import { validDate } from './workouts'
import { validWorkoutId } from './workout-detail'

export interface TrendPoint { date: string; weight: number | null; reps: number | null }
export interface StatsDetail {
  workoutId: string
  name: string
  date: string
  totalVolume: number
  exerciseTrends: { name: string; points: TrendPoint[] }[]
  comparison: null | { previousWorkoutId: string; previousDate: string; previousVolume: number; volumeDifference: number }
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
function number(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) }

export function parseStatsDetail(payload: unknown, id: string): StatsDetail {
  const invalid = () => new ApiError('Server tagastas ootamatud statistikaandmed.')
  if (!record(payload) || payload.workoutId !== id || !validDate(payload.date)
    || (payload.name != null && typeof payload.name !== 'string') || !number(payload.totalVolume) || payload.totalVolume < 0
    || !record(payload.exerciseTrends)) throw invalid()
  const trends = Object.entries(payload.exerciseTrends).map(([name, values]) => {
    if (!name.trim() || !Array.isArray(values)) throw invalid()
    const points = values.map((value: unknown): TrendPoint => {
      if (!record(value) || !validDate(value.date)
        || (value.weight !== null && (!number(value.weight) || value.weight < 0))
        || (value.reps !== null && (!number(value.reps) || !Number.isSafeInteger(value.reps) || value.reps < 0))) throw invalid()
      return { date: value.date, weight: value.weight as number | null, reps: value.reps as number | null }
    }).sort((a, b) => a.date.localeCompare(b.date))
    return { name, points }
  })
  let comparison: StatsDetail['comparison'] = null
  if (payload.comparison !== null) {
    const previous = payload.comparison
    if (!record(previous) || typeof previous.previousWorkoutId !== 'string' || !validWorkoutId(previous.previousWorkoutId)
      || previous.previousWorkoutId === id || !validDate(previous.previousDate) || previous.previousDate >= payload.date
      || !number(previous.previousVolume) || previous.previousVolume < 0 || !number(previous.volumeDifference)) throw invalid()
    comparison = {
      previousWorkoutId: previous.previousWorkoutId, previousDate: previous.previousDate,
      previousVolume: previous.previousVolume, volumeDifference: previous.volumeDifference,
    }
  }
  return {
    workoutId: id, name: typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : 'Treening',
    date: payload.date, totalVolume: payload.totalVolume, exerciseTrends: trends, comparison,
  }
}

export async function fetchStatsDetail(userId: string, token: string, id: string, options?: ApiOptions): Promise<StatsDetail> {
  if (!userId) throw new ApiError('Sisselogimine on vajalik.', 401)
  if (!validWorkoutId(id)) throw new ApiError('Treeningu ID on vigane.', 400)
  return parseStatsDetail(await apiGet(`/stats/detail/${encodeURIComponent(id)}`, token, options), id)
}

export type StatsDetailState =
  | { status: 'loading' }
  | { status: 'success'; stats: StatsDetail }
  | { status: 'error' | 'not-found' | 'unauthenticated'; message: string }

export function startStatsDetailRequest(userId: string, token: string, id: string,
  publish: (state: StatsDetailState) => void, options: Omit<ApiOptions, 'signal'> = {}): () => void {
  let active = true
  const controller = new AbortController()
  publish({ status: 'loading' })
  void fetchStatsDetail(userId, token, id, { ...options, signal: controller.signal }).then((stats) => {
    if (active) publish({ status: 'success', stats })
  }).catch((error: unknown) => {
    if (active && !controller.signal.aborted) publish({
      status: error instanceof ApiError && error.status === 401 ? 'unauthenticated'
        : error instanceof ApiError && error.status === 404 ? 'not-found' : 'error',
      message: error instanceof ApiError ? error.message : 'Statistikat ei saanud laadida. Kontrolli internetiühendust ja proovi uuesti.',
    })
  })
  return () => { active = false; controller.abort() }
}
