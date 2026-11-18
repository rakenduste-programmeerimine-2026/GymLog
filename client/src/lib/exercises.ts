import { ApiError, apiGet, apiPost } from './api'
import type { ApiOptions } from './api'

export interface Exercise { id: string; name: string; category: string | null; shared: boolean }
export interface ExerciseDraft { name: string; category: string }

export function validateExercise(draft: ExerciseDraft): { name?: string } {
  return draft.name.trim() ? {} : { name: 'Sisesta harjutuse nimi.' }
}

export function parseExercise(value: unknown, userId: string): Exercise {
  const invalid = () => new ApiError('Server tagastas ootamatud harjutuste andmed.')
  if (!value || typeof value !== 'object') throw invalid()
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string' || !row.id || typeof row.name !== 'string' || !row.name.trim()
    || (row.user_id !== null && row.user_id !== userId)
    || (row.category != null && typeof row.category !== 'string')) throw invalid()
  return {
    id: row.id, name: row.name.trim(),
    category: typeof row.category === 'string' && row.category.trim() ? row.category.trim() : null,
    shared: row.user_id === null,
  }
}

export async function fetchExercises(userId: string, token: string, options?: ApiOptions): Promise<Exercise[]> {
  if (!userId) throw new ApiError('Sisselogimine on vajalik.', 401)
  const data = await apiGet('/exercises', token, options)
  if (!Array.isArray(data)) throw new ApiError('Server tagastas ootamatud harjutuste andmed.')
  const ids = new Set<string>()
  return data.map((row) => {
    const exercise = parseExercise(row, userId)
    if (ids.has(exercise.id)) throw new ApiError('Server tagastas ootamatud harjutuste andmed.')
    ids.add(exercise.id)
    return exercise
  }).sort((a, b) => a.name.localeCompare(b.name, 'et'))
}

export async function createExercise(userId: string, token: string, draft: ExerciseDraft, options?: ApiOptions): Promise<Exercise> {
  if (!userId) throw new ApiError('Sisselogimine on vajalik.', 401)
  if (validateExercise(draft).name) throw new ApiError('Sisesta harjutuse nimi.')
  const body = { name: draft.name.trim(), ...(draft.category.trim() ? { category: draft.category.trim() } : {}) }
  const exercise = parseExercise(await apiPost('/exercises', token, body, options), userId)
  if (exercise.shared) throw new ApiError('Isikliku harjutuse salvestamist ei saanud kinnitada. Kontrolli loendit enne uut katset.')
  return exercise
}

export function createExerciseSubmitter() {
  let busy = false
  return async (userId: string, token: string, draft: ExerciseDraft, options?: ApiOptions): Promise<Exercise | null> => {
    if (busy) return null
    busy = true
    try { return await createExercise(userId, token, draft, options) } finally { busy = false }
  }
}

export type ExercisesState =
  | { status: 'loading' }
  | { status: 'success'; exercises: Exercise[] }
  | { status: 'error' | 'unauthenticated'; message: string }

export function exerciseErrorMessage(error: unknown, write = false): string {
  if (error instanceof ApiError) return error.message
  return write
    ? 'Ühendus katkes. Salvestamise tulemus pole teada. Kontrolli harjutuste loendit enne uuesti proovimist.'
    : 'Harjutusi ei saanud laadida. Kontrolli internetiühendust ja proovi uuesti.'
}

export function startExercisesRequest(userId: string, token: string, publish: (state: ExercisesState) => void,
  options: Omit<ApiOptions, 'signal'> = {}): () => void {
  let active = true
  const controller = new AbortController()
  publish({ status: 'loading' })
  void fetchExercises(userId, token, { ...options, signal: controller.signal }).then((exercises) => {
    if (active) publish({ status: 'success', exercises })
  }).catch((error: unknown) => {
    if (active && !controller.signal.aborted) publish({
      status: error instanceof ApiError && error.status === 401 ? 'unauthenticated' : 'error',
      message: exerciseErrorMessage(error),
    })
  })
  return () => { active = false; controller.abort() }
}
