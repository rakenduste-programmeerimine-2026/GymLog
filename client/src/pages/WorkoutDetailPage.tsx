import { useEffect, useRef, useState } from 'react'
import Header from '../components/Header'
import ProtectedNavigation from '../components/ProtectedNavigation'
import WorkoutEditForm from '../components/WorkoutEditForm'
import { useAuth } from '../context/AuthContext'
import { formatWorkoutDate } from '../lib/workouts'
import {
  createDetailActions, deleteWorkoutDetail, detailErrorState, startDetailRequest, updateWorkoutDetail,
} from '../lib/workout-detail'
import type { DetailState, WorkoutDetail } from '../lib/workout-detail'
import type { CreateWorkoutBody } from '../lib/new-workout'
import type { Navigate } from '../lib/navigation'
import { authPath } from '../lib/routes'

export function WorkoutDetailContent({ workout }: { workout: WorkoutDetail }) {
  return (
    <>
      <h2>{workout.name}</h2>
      <p><time dateTime={workout.date}>{formatWorkoutDate(workout.date)}</time></p>
      {!workout.sets.length ? <p>Treeningus pole seeriaid.</p> : (
        <ol className="workouts-list detail-sets">
          {workout.sets.map((set, index) => (
            <li className="workout-card" key={set.id}>
              <h3>{set.exercise_name}</h3>
              <p>Seeria {index + 1}</p>
              <dl className="set-values">
                <div><dt>Raskus</dt><dd>{new Intl.NumberFormat('et-EE').format(set.weight)} kg</dd></div>
                <div><dt>Kordused</dt><dd>{set.reps}</dd></div>
              </dl>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}

export default function WorkoutDetailPage({ id, navigate }: { id: string; navigate: Navigate }) {
  const { user, session, signOut } = useAuth()
  const userId = user?.id ?? ''
  const token = session?.access_token ?? ''
  const [result, setResult] = useState<{ userId: string; token: string; id: string; state: DetailState } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null)
  const [saved, setSaved] = useState(false)
  const [actions] = useState(createDetailActions)
  const pending = useRef(false)
  const mounted = useRef(false)
  const writeRequest = useRef<AbortController | null>(null)
  const currentToken = useRef(token)
  currentToken.current = token

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; writeRequest.current?.abort() }
  }, [])

  useEffect(() => {
    writeRequest.current?.abort()
    setBusy(null)
    setResult(null); setEditing(false); setSaved(false)
    return startDetailRequest(id, userId, token, (state) => setResult({ userId, token, id, state }))
  }, [id, userId, token, attempt])

  const state: DetailState = result?.userId === userId && result.token === token && result.id === id
    ? result.state : { status: 'loading' }

  function publish(state: DetailState) { setResult({ userId, token, id, state }) }

  async function save(body: CreateWorkoutBody) {
    if (pending.current) return
    pending.current = true; setBusy('save'); setSaved(false)
    const controller = new AbortController()
    writeRequest.current = controller
    try {
      const workout = await actions.save(() => updateWorkoutDetail(id, userId, token, body, { signal: controller.signal }))
      if (workout && mounted.current && currentToken.current === token && !controller.signal.aborted) {
        publish({ status: 'success', workout }); setEditing(false); setSaved(true)
      }
    } catch (error: unknown) {
      if (mounted.current && !controller.signal.aborted) { publish(detailErrorState(error, true)); setEditing(false) }
    } finally {
      pending.current = false
      if (mounted.current) setBusy(null)
    }
  }

  async function remove() {
    if (pending.current || state.status !== 'success') return
    pending.current = true; setBusy('delete'); setSaved(false)
    const controller = new AbortController()
    writeRequest.current = controller
    try {
      const removed = await actions.remove(
        () => window.confirm(`Kas soovid treeningu „${state.workout.name}” kustutada? Seda ei saa tagasi võtta.`),
        () => deleteWorkoutDetail(id, userId, token, { signal: controller.signal }),
      )
      if (removed && mounted.current && currentToken.current === token && !controller.signal.aborted) navigate('/workouts?deleted=1', true)
    } catch (error: unknown) {
      if (mounted.current && !controller.signal.aborted) publish(detailErrorState(error, true))
    } finally {
      pending.current = false
      if (mounted.current) setBusy(null)
    }
  }

  async function loginAgain() {
    try { await signOut(); navigate(authPath('login', `/workouts/${encodeURIComponent(id)}`), true) }
    catch { publish({ status: 'error', message: 'Väljalogimine ebaõnnestus. Proovi uuesti.' }) }
  }

  return (
    <div className="app">
      <Header />
      {!busy && <ProtectedNavigation navigate={navigate} current="/workouts" />}
      <main aria-labelledby="detail-title">
        <h1 id="detail-title">Treeningu üksikasjad</h1>
        {state.status === 'loading' ? <p role="status">Laadin treeningut…</p>
          : state.status === 'success' ? (
            <>
              {editing ? <WorkoutEditForm workout={state.workout} busy={Boolean(busy)}
                onSave={(body) => { void save(body) }} onCancel={() => setEditing(false)} />
                : <WorkoutDetailContent workout={state.workout} />}
              {saved && <p className="login-notice" role="status">Muudatused salvestatud.</p>}
              {!editing && (
                <div className="detail-actions">
                  <button className="auth-navigation" disabled={Boolean(busy)} onClick={() => { setSaved(false); setEditing(true) }}>Muuda treeningut</button>
                  <button className="danger-button" disabled={Boolean(busy)} onClick={() => { void remove() }}>Kustuta treening</button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="login-error" role="alert">{state.message}</p>
              {state.status === 'unauthenticated' ? (
                <button className="auth-navigation" onClick={() => { void loginAgain() }}>Logi uuesti sisse</button>
              ) : state.status === 'error' && <button className="auth-navigation" onClick={() => setAttempt((value) => value + 1)}>Laadi treening uuesti</button>}
            </>
          )}
        <p role="status">{busy === 'delete' ? 'Kustutan treeningut…' : busy === 'save' ? 'Salvestan muudatusi…' : ''}</p>
        <button className="auth-navigation" disabled={Boolean(busy)} onClick={() => navigate('/workouts')}>← Tagasi treeningute juurde</button>
      </main>
    </div>
  )
}
