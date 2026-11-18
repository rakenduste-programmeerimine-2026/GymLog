import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Header from '../components/Header'
import ProtectedNavigation from '../components/ProtectedNavigation'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../lib/api'
import { createExerciseSubmitter, exerciseErrorMessage, startExercisesRequest, validateExercise } from '../lib/exercises'
import type { ExercisesState } from '../lib/exercises'
import { authPath } from '../lib/routes'
import type { Navigate } from '../lib/navigation'

export function ExercisesContent({ state, onRetry, onLogin }: {
  state: ExercisesState; onRetry: () => void; onLogin: () => void
}) {
  if (state.status === 'loading') return <p role="status">Laadin harjutusi…</p>
  if (state.status !== 'success') return (
    <div>
      <p className="login-error" role="alert">{state.message}</p>
      {state.status === 'unauthenticated'
        ? <button className="auth-navigation" onClick={onLogin}>Logi uuesti sisse</button>
        : <button className="auth-navigation" onClick={onRetry}>Proovi uuesti</button>}
    </div>
  )
  if (!state.exercises.length) return <p role="status">Harjutusi pole veel. Lisa allpool oma esimene harjutus.</p>
  return (
    <ul className="workouts-list">
      {state.exercises.map((exercise) => (
        <li className="workout-card" key={exercise.id}>
          <h2>{exercise.name}</h2>
          <p className={`exercise-badge ${exercise.shared ? 'exercise-shared' : 'exercise-personal'}`}>
            {exercise.shared ? 'Ühine harjutus' : 'Minu harjutus'}
          </p>
          <p>Kategooria: {exercise.category ?? 'Määramata'}</p>
        </li>
      ))}
    </ul>
  )
}

export default function ExercisesPage({ navigate }: { navigate: Navigate }) {
  const { user, session, signOut } = useAuth()
  const userId = user?.id ?? ''
  const token = session?.access_token ?? ''
  const [result, setResult] = useState<{ token: string; userId: string; state: ExercisesState } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [draft, setDraft] = useState({ name: '', category: '' })
  const [nameError, setNameError] = useState<string | undefined>()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [created, setCreated] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [expired, setExpired] = useState(false)
  const [submit] = useState(createExerciseSubmitter)
  const pending = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const feedback = useRef<HTMLParagraphElement>(null)
  const mounted = useRef(false)
  const write = useRef<AbortController | null>(null)
  const currentToken = useRef(token)
  currentToken.current = token

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; write.current?.abort() }
  }, [])

  useEffect(() => {
    write.current?.abort()
    setSubmitting(false); setSubmitError(null); setExpired(false); setCreated(false)
  }, [userId, token])

  useEffect(() => {
    setResult(null)
    return startExercisesRequest(userId, token, (state) => setResult({ userId, token, state }))
  }, [userId, token, attempt])

  useEffect(() => { if (submitError || created) feedback.current?.focus() }, [submitError, created])

  const state: ExercisesState = result?.userId === userId && result.token === token ? result.state : { status: 'loading' }
  const unauthenticated = expired || state.status === 'unauthenticated' || !userId || !token

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current || unauthenticated) return
    const errors = validateExercise(draft)
    setNameError(errors.name); setSubmitError(null); setCreated(false)
    if (errors.name) { input.current?.focus(); return }
    pending.current = true; setSubmitting(true)
    const controller = new AbortController()
    write.current = controller
    try {
      const exercise = await submit(userId, token, draft, { signal: controller.signal })
      if (exercise && mounted.current && currentToken.current === token && !controller.signal.aborted) {
        setDraft({ name: '', category: '' }); setCreated(true)
        setResult(null); setAttempt((value) => value + 1)
      }
    } catch (error: unknown) {
      if (!mounted.current || controller.signal.aborted || currentToken.current !== token) return
      setSubmitError(exerciseErrorMessage(error, true))
      if (error instanceof ApiError && error.status === 401) {
        setExpired(true)
        setResult({ userId, token, state: { status: 'unauthenticated', message: exerciseErrorMessage(error) } })
      }
    } finally {
      pending.current = false
      if (mounted.current && currentToken.current === token) setSubmitting(false)
    }
  }

  async function loginAgain() {
    try { await signOut(); navigate(authPath('login', '/exercises'), true) }
    catch { setSubmitError('Väljalogimine ebaõnnestus. Proovi uuesti.') }
  }

  return (
    <div className="app">
      <Header />
      {!submitting && <ProtectedNavigation navigate={navigate} current="/exercises" />}
      <main aria-labelledby="exercises-title">
        <h1 id="exercises-title">Harjutused</h1>
        <p className="login-intro">Ühised harjutused ja sinu isiklikud harjutused.</p>
        <ExercisesContent state={state} onRetry={() => { setResult(null); setAttempt((value) => value + 1) }}
          onLogin={() => { void loginAgain() }} />
        <section className="exercise-create" aria-labelledby="exercise-create-title">
          <h2 id="exercise-create-title">Lisa isiklik harjutus</h2>
          <p className="login-intro">Lisatud harjutus on nähtav ainult sulle.</p>
          <form onSubmit={handleSubmit} noValidate aria-busy={submitting}>
            <fieldset className="workout-form-fields" disabled={submitting || unauthenticated}>
              <legend className="visually-hidden">Isikliku harjutuse andmed</legend>
              <div className="login-field">
                <label htmlFor="exercise-name">Harjutuse nimi</label>
                <input id="exercise-name" name="name" required value={draft.name} ref={input}
                  aria-invalid={Boolean(nameError)} aria-describedby={nameError ? 'exercise-name-error' : undefined}
                  onChange={(event) => { setDraft({ ...draft, name: event.target.value }); setNameError(undefined); setSubmitError(null); setCreated(false) }} />
                {nameError && <p className="login-error" id="exercise-name-error">{nameError}</p>}
              </div>
              <div className="login-field">
                <label htmlFor="exercise-category">Kategooria (valikuline)</label>
                <input id="exercise-category" name="category" value={draft.category}
                  onChange={(event) => { setDraft({ ...draft, category: event.target.value }); setSubmitError(null); setCreated(false) }} />
              </div>
              <button className="login-submit" type="submit">{submitting ? 'Salvestan…' : 'Lisa harjutus'}</button>
            </fieldset>
            <p role="status">{submitting ? 'Harjutuse salvestamine on pooleli.' : ''}</p>
            <p ref={feedback} tabIndex={-1} role={submitError ? 'alert' : 'status'} className={submitError ? 'login-error' : 'exercise-feedback'}>
              {submitError ?? (created ? `Isiklik harjutus salvestatud.${state.status === 'loading' ? ' Loendit värskendatakse.' : ''}` : '')}
            </p>
          </form>
        </section>
      </main>
    </div>
  )
}
