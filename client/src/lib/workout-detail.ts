import { ApiError, apiDelete, apiGet, apiPut } from './api'
import type { ApiOptions } from './api'
import { validDate } from './workouts'
import { hasWorkoutErrors, validateWorkout, workoutBody } from './new-workout'
import type { WorkoutDraft, CreateWorkoutBody } from './new-workout'

export interface WorkoutSet {
  id: string
  exercise_id: string
  exercise_name: string
  weight: number
  reps: number
  set_order: number
}
export interface WorkoutDetail { id: string; name: string; date: string; sets: WorkoutSet[] }

// IDs are opaque backend identifiers. Reject path/query injection without assuming UUIDs.
export function validWorkoutId(id: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id) && id !== 'new'
}

function endpoint(id: string, userId: string): string {
  if (!userId) throw new ApiError('Sisselogimine on vajalik.', 401)
  if (!validWorkoutId(id)) throw new ApiError('Treeningu ID on vigane.', 400)
  return `/workouts/${encodeURIComponent(id)}`
}

export function parseWorkoutDetail(value: unknown, id: string, userId: string): WorkoutDetail {
  const invalid = () => new ApiError('Server tagastas ootamatud treeninguandmed.')
  if (!value || typeof value !== 'object') throw invalid()
  const row = value as Record<string, unknown>
  if (row.id !== id || row.user_id !== userId || !validDate(row.date) || !Array.isArray(row.sets)
    || (row.name != null && typeof row.name !== 'string')) throw invalid()
  const ids = new Set<string>()
  const orders = new Set<number>()
  const sets = row.sets.map((item: unknown): WorkoutSet => {
    if (!item || typeof item !== 'object') throw invalid()
    const set = item as Record<string, unknown>
    if (typeof set.id !== 'string' || !set.id || ids.has(set.id) || set.workout_id !== id
      || typeof set.exercise_id !== 'string' || !set.exercise_id
      || typeof set.exercise_name !== 'string' || !set.exercise_name.trim()
      || typeof set.weight !== 'number' || !Number.isFinite(set.weight) || set.weight < 0
      || typeof set.reps !== 'number' || !Number.isSafeInteger(set.reps) || set.reps < 1
      || typeof set.set_order !== 'number' || !Number.isSafeInteger(set.set_order) || set.set_order < 1
      || orders.has(set.set_order)) throw invalid()
    ids.add(set.id); orders.add(set.set_order)
    return {
      id: set.id, exercise_id: set.exercise_id, exercise_name: set.exercise_name,
      weight: set.weight, reps: set.reps, set_order: set.set_order,
    }
  }).sort((a, b) => a.set_order - b.set_order)
  return { id, date: row.date, name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : 'Treening', sets }
}

export async function fetchWorkoutDetail(id: string, userId: string, token: string, options?: ApiOptions): Promise<WorkoutDetail> {
  return parseWorkoutDetail(await apiGet(endpoint(id, userId), token, options), id, userId)
}

export function detailDraft(workout: WorkoutDetail): WorkoutDraft {
  return { name: workout.name, date: workout.date, sets: workout.sets.map((set) => ({
    exerciseId: set.exercise_id, weight: String(set.weight), reps: String(set.reps),
  })) }
}

export function detailExercises(workout: WorkoutDetail) {
  return workout.sets.map((set) => ({ id: set.exercise_id, name: set.exercise_name }))
}

export function validateWorkoutEdit(draft: WorkoutDraft, original: WorkoutDetail) {
  const errors = validateWorkout(draft, detailExercises(original))
  // PUT explicitly allows an empty sets array; this editor preserves existing sets.
  if (original.sets.length === 0 && draft.sets.length === 0) delete errors.sets
  if (draft.sets.length !== original.sets.length) errors.sets = 'Seeriate arv ei vasta algsele treeningule.'
  return errors
}

export function editBody(draft: WorkoutDraft, original: WorkoutDetail): CreateWorkoutBody {
  if (hasWorkoutErrors(validateWorkoutEdit(draft, original))) throw new ApiError('Kontrolli vormi välju.')
  if (!original.sets.length) return { name: draft.name.trim(), date: draft.date, sets: [] }
  const body = workoutBody(draft, detailExercises(original))
  // Keep each set's existing exercise identity/name, including repeated exercises.
  body.sets = body.sets.map((set, index) => ({ ...set,
    exercise_id: original.sets[index].exercise_id, exercise_name: original.sets[index].exercise_name,
  }))
  return body
}

export async function updateWorkoutDetail(id: string, userId: string, token: string, body: CreateWorkoutBody,
  options?: ApiOptions): Promise<WorkoutDetail> {
  return parseWorkoutDetail(await apiPut(endpoint(id, userId), token, body, options), id, userId)
}

export async function deleteWorkoutDetail(id: string, userId: string, token: string, options?: ApiOptions): Promise<void> {
  await apiDelete(endpoint(id, userId), token, options)
}

// Shared lock for edit/delete; confirmation happens before any DELETE request.
export function createDetailActions() {
  let busy = false
  let deleted = false
  return {
    async save(action: () => Promise<WorkoutDetail>): Promise<WorkoutDetail | null> {
      if (busy || deleted) return null
      busy = true
      try { return await action() } finally { busy = false }
    },
    async remove(confirm: () => boolean, action: () => Promise<void>): Promise<boolean> {
      if (busy || deleted) return false
      busy = true
      try {
        if (!confirm()) return false
        await action()
        deleted = true
        return true
      } finally { busy = false }
    },
  }
}

export type DetailState =
  | { status: 'loading' }
  | { status: 'success'; workout: WorkoutDetail }
  | { status: 'error' | 'not-found' | 'unauthenticated'; message: string }

export function detailErrorState(error: unknown, write = false): DetailState {
  const status = error instanceof ApiError && error.status === 401 ? 'unauthenticated'
    : error instanceof ApiError && error.status === 404 ? 'not-found' : 'error'
  return { status, message: error instanceof ApiError ? error.message
    : write ? 'Ühendus katkes. Toimingu tulemus pole teada. Laadi treening uuesti enne uut katset.'
      : 'Treeningut ei saanud laadida. Kontrolli internetiühendust ja proovi uuesti.' }
}

export function startDetailRequest(id: string, userId: string, token: string,
  publish: (state: DetailState) => void, options: Omit<ApiOptions, 'signal'> = {}): () => void {
  let active = true
  const controller = new AbortController()
  publish({ status: 'loading' })
  void fetchWorkoutDetail(id, userId, token, { ...options, signal: controller.signal }).then((workout) => {
    if (active) publish({ status: 'success', workout })
  }).catch((error: unknown) => {
    if (active && !controller.signal.aborted) publish(detailErrorState(error))
  })
  return () => { active = false; controller.abort() }
}
