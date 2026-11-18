import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Header from '../components/Header'
import ProtectedNavigation from '../components/ProtectedNavigation'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../lib/api'
import {
  createWorkoutSubmitter, creationErrorMessage, emptySet, fetchExerciseOptions,
  hasWorkoutErrors, validateWorkout, workoutBody,
} from '../lib/new-workout'
import type { ExerciseOption, WorkoutDraft, WorkoutErrors } from '../lib/new-workout'
import type { Navigate } from '../lib/navigation'
import { authPath } from '../lib/routes'

export default function NewWorkoutPage({ navigate }: { navigate: Navigate }) {
  const { user, session, signOut } = useAuth()
  const userId = user?.id ?? ''
  const token = session?.access_token ?? ''
  const [draft, setDraft] = useState<WorkoutDraft>({ name: '', date: '', sets: [emptySet()] })
  const [errors, setErrors] = useState<WorkoutErrors>({ rows: [] })
  const [options, setOptions] = useState<{ token: string; exercises: ExerciseOption[] } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const [submit] = useState(createWorkoutSubmitter)
  const form = useRef<HTMLFormElement>(null)
  const feedback = useRef<HTMLParagraphElement>(null)
  const request = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  const pending = useRef(false)
  const exercises = options?.token === token ? options.exercises : []
  const loading = !options || options.token !== token

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; request.current?.abort() }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setOptions(null); setLoadError(null); setExpired(false)
    void fetchExerciseOptions(userId, token, { signal: controller.signal }).then((data) => {
      if (active) setOptions({ token, exercises: data })
    }).catch((error: unknown) => {
      if (!active || controller.signal.aborted) return
      setLoadError(error instanceof ApiError ? error.message : 'Harjutusi ei saanud laadida. Kontrolli internetiühendust ja proovi uuesti.')
      setExpired(error instanceof ApiError && error.status === 401)
    })
    return () => { active = false; controller.abort() }
  }, [userId, token, attempt])

  useEffect(() => { if (submitError) feedback.current?.focus() }, [submitError])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current || submitting || loading || !exercises.length || expired) return
    setSubmitError(null)
    const nextErrors = validateWorkout(draft, exercises)
    setErrors(nextErrors)
    if (hasWorkoutErrors(nextErrors)) {
      // Focus after React commits the field error attributes.
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    const controller = new AbortController()
    pending.current = true
    request.current = controller
    setSubmitting(true)
    try {
      const id = await submit(userId, token, workoutBody(draft, exercises), { signal: controller.signal })
      if (id && mounted.current) navigate(`/workouts?created=${encodeURIComponent(id)}`, true)
    } catch (error: unknown) {
      if (!mounted.current || controller.signal.aborted) return
      setSubmitError(creationErrorMessage(error))
      setExpired(error instanceof ApiError && error.status === 401)
    } finally {
      pending.current = false
      if (mounted.current) setSubmitting(false)
    }
  }

  async function loginAgain() {
    try { await signOut(); navigate(authPath('login', '/workouts/new'), true) }
    catch { setSubmitError('Väljalogimine ebaõnnestus. Proovi uuesti.') }
  }

  return (
    <div className="app">
      <Header />
      {!submitting && <ProtectedNavigation navigate={navigate} current="/workouts" />}
      <main aria-labelledby="new-workout-title">
        <h1 id="new-workout-title">Uus treening</h1>
        {loadError ? (
          <div>
            <p className="login-error" role="alert">{loadError}</p>
            {!expired && <button className="auth-navigation" onClick={() => setAttempt((value) => value + 1)}>Proovi uuesti</button>}
          </div>
        ) : loading ? <p role="status">Laadin harjutusi…</p>
          : !exercises.length && <p role="status">Harjutusi pole saadaval. Treeningu salvestamiseks on vaja vähemalt ühte harjutust.</p>}
        <form ref={form} onSubmit={handleSubmit} noValidate aria-busy={submitting}>
          <fieldset className="workout-form-fields" disabled={submitting}>
            <legend className="visually-hidden">Treeningu andmed</legend>
            <div className="login-field">
              <label htmlFor="workout-name">Treeningu nimi</label>
              <input id="workout-name" name="name" required value={draft.name}
                aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'name-error' : undefined}
                onChange={(event) => { setDraft({ ...draft, name: event.target.value }); setErrors({ rows: [] }) }} />
              {errors.name && <p className="login-error" id="name-error">{errors.name}</p>}
            </div>
            <div className="login-field">
              <label htmlFor="workout-date">Kuupäev</label>
              <input id="workout-date" name="date" type="date" required value={draft.date}
                aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? 'date-error' : undefined}
                onChange={(event) => { setDraft({ ...draft, date: event.target.value }); setErrors({ rows: [] }) }} />
              {errors.date && <p className="login-error" id="date-error">{errors.date}</p>}
            </div>
            {errors.sets && <p className="login-error">{errors.sets}</p>}
            {draft.sets.map((set, index) => (
              <fieldset className="workout-card workout-set" key={index}>
                <legend>Seeria {index + 1}</legend>
                <div className="login-field">
                  <label htmlFor={`exercise-${index}`}>Harjutus</label>
                  <select id={`exercise-${index}`} required value={set.exerciseId} disabled={loading || Boolean(loadError)}
                    aria-invalid={Boolean(errors.rows[index]?.exerciseId)}
                    aria-describedby={errors.rows[index]?.exerciseId ? `exercise-error-${index}` : undefined}
                    onChange={(event) => {
                      setDraft({ ...draft, sets: draft.sets.map((row, i) => i === index ? { ...row, exerciseId: event.target.value } : row) })
                      setErrors({ rows: [] })
                    }}>
                    <option value="">Vali harjutus</option>
                    {exercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
                  </select>
                  {errors.rows[index]?.exerciseId && <p className="login-error" id={`exercise-error-${index}`}>{errors.rows[index].exerciseId}</p>}
                </div>
                {(['weight', 'reps'] as const).map((field) => (
                  <div className="login-field" key={field}>
                    <label htmlFor={`${field}-${index}`}>{field === 'weight' ? 'Raskus (kg)' : 'Kordused'}</label>
                    <input id={`${field}-${index}`} type="number" required min={field === 'weight' ? 0 : 1}
                      step={field === 'weight' ? 'any' : 1} inputMode={field === 'weight' ? 'decimal' : 'numeric'}
                      value={set[field]} aria-invalid={Boolean(errors.rows[index]?.[field])}
                      aria-describedby={errors.rows[index]?.[field] ? `${field}-error-${index}` : undefined}
                      onChange={(event) => {
                        setDraft({ ...draft, sets: draft.sets.map((row, i) => i === index ? { ...row, [field]: event.target.value } : row) })
                        setErrors({ rows: [] })
                      }} />
                    {errors.rows[index]?.[field] && <p className="login-error" id={`${field}-error-${index}`}>{errors.rows[index][field]}</p>}
                  </div>
                ))}
              </fieldset>
            ))}
            <button className="auth-navigation" type="button" onClick={() => setDraft({ ...draft, sets: [...draft.sets, emptySet()] })}>+ Lisa seeria</button>
            <button className="login-submit" type="submit" disabled={loading || Boolean(loadError) || !exercises.length || expired}>
              {submitting ? 'Salvestan…' : 'Salvesta treening'}
            </button>
          </fieldset>
          <p role="status">{submitting ? 'Treeningu salvestamine on pooleli.' : ''}</p>
          <p className="login-error" ref={feedback} tabIndex={-1} role="alert">{submitError}</p>
        </form>
        {expired && <button className="auth-navigation" onClick={() => { void loginAgain() }}>Logi uuesti sisse</button>}
        <button className="auth-navigation" disabled={submitting} onClick={() => navigate('/workouts')}>Tagasi treeningute juurde</button>
      </main>
    </div>
  )
}
