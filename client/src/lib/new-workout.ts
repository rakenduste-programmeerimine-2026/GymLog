import { ApiError, apiPost } from './api'
import type { ApiOptions } from './api'
import { validDate } from './workouts'
import { fetchExercises } from './exercises'

export interface ExerciseOption { id: string; name: string }
export interface SetDraft { exerciseId: string; weight: string; reps: string }
export interface WorkoutDraft { name: string; date: string; sets: SetDraft[] }
export interface SetErrors { exerciseId?: string; weight?: string; reps?: string }
export interface WorkoutErrors { name?: string; date?: string; sets?: string; rows: SetErrors[] }
export interface CreateWorkoutBody {
  name: string
  date: string
  sets: { exercise_id: string; exercise_name: string; weight: number; reps: number }[]
}

export function emptySet(): SetDraft { return { exerciseId: '', weight: '', reps: '' } }

function numeric(value: string): number { return Number(value.trim().replace(',', '.')) }

export function validateWorkout(draft: WorkoutDraft, exercises: ExerciseOption[]): WorkoutErrors {
  const errors: WorkoutErrors = { rows: [] }
  if (!draft.name.trim()) errors.name = 'Sisesta treeningu nimi.'
  if (!draft.date) errors.date = 'Vali treeningu kuupäev.'
  else if (!validDate(draft.date)) errors.date = 'Sisesta kehtiv kuupäev.'
  if (!draft.sets.length) errors.sets = 'Lisa vähemalt üks seeria.'
  errors.rows = draft.sets.map((set) => {
    const row: SetErrors = {}
    if (!exercises.some((exercise) => exercise.id === set.exerciseId)) row.exerciseId = 'Vali harjutus.'
    if (!set.weight.trim() || !Number.isFinite(numeric(set.weight)) || numeric(set.weight) < 0) {
      row.weight = 'Sisesta raskus null või suurem.'
    }
    if (!set.reps.trim() || !Number.isSafeInteger(numeric(set.reps)) || numeric(set.reps) < 1) {
      row.reps = 'Sisesta vähemalt üks täisarvuline kordus.'
    }
    return row
  })
  return errors
}

export function hasWorkoutErrors(errors: WorkoutErrors): boolean {
  return Boolean(errors.name || errors.date || errors.sets || errors.rows.some((row) => Object.keys(row).length))
}

export function workoutBody(draft: WorkoutDraft, exercises: ExerciseOption[]): CreateWorkoutBody {
  if (hasWorkoutErrors(validateWorkout(draft, exercises))) throw new ApiError('Kontrolli vormi välju.')
  return {
    name: draft.name.trim(), date: draft.date,
    sets: draft.sets.map((set) => ({
      exercise_id: set.exerciseId,
      exercise_name: exercises.find((exercise) => exercise.id === set.exerciseId)!.name,
      weight: numeric(set.weight), reps: numeric(set.reps),
    })),
  }
}

export async function fetchExerciseOptions(userId: string, token: string, options?: ApiOptions): Promise<ExerciseOption[]> {
  return (await fetchExercises(userId, token, options)).map(({ id, name }) => ({ id, name }))
}

export async function createWorkout(userId: string, token: string, body: CreateWorkoutBody, options?: ApiOptions): Promise<string> {
  if (!userId) throw new ApiError('Sisselogimine on vajalik.', 401)
  const data = await apiPost('/workouts', token, body, options)
  if (!data || typeof data !== 'object' || !('id' in data) || typeof data.id !== 'string' || !data.id
    || !('user_id' in data) || data.user_id !== userId) {
    throw new ApiError('Salvestamise vastust ei saanud kinnitada. Kontrolli treeningute loendit enne uuesti salvestamist.')
  }
  return data.id
}

// One request at a time, and no second write after success while this form remains mounted.
export function createWorkoutSubmitter() {
  let busy = false
  let completed = false
  return async (userId: string, token: string, body: CreateWorkoutBody, options?: ApiOptions): Promise<string | null> => {
    if (busy || completed) return null
    busy = true
    try {
      const id = await createWorkout(userId, token, body, options)
      completed = true
      return id
    } finally { busy = false }
  }
}

export function creationErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message
    : 'Ühendus serveriga ebaõnnestus. Salvestamise tulemus pole teada. Kontrolli treeningute loendit enne uuesti proovimist.'
}
