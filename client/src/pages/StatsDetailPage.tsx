import { useEffect, useState } from 'react'
import Header from '../components/Header'
import ProtectedNavigation from '../components/ProtectedNavigation'
import RouteLink from '../components/RouteLink'
import StatsDetailContent from '../components/StatsDetailContent'
import { useAuth } from '../context/AuthContext'
import { startWorkoutsRequest, formatWorkoutDate } from '../lib/workouts'
import type { WorkoutsState } from '../lib/workouts'
import { startStatsDetailRequest } from '../lib/stats-detail'
import type { StatsDetailState } from '../lib/stats-detail'
import { validWorkoutId } from '../lib/workout-detail'
import { authPath } from '../lib/routes'
import type { Navigate } from '../lib/navigation'

export default function StatsDetailPage({ id, navigate }: { id: string | null; navigate: Navigate }) {
  const { user, session, signOut } = useAuth()
  const userId = user?.id ?? ''
  const token = session?.access_token ?? ''
  const [attempt, setAttempt] = useState(0)
  const [list, setList] = useState<{ userId: string; token: string; state: WorkoutsState } | null>(null)
  const [result, setResult] = useState<{ userId: string; token: string; id: string; state: StatsDetailState } | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)

  useEffect(() => {
    setList(null); setResult(null); setLoginError(null)
    return startWorkoutsRequest(userId, token, (state) => setList({ userId, token, state }))
  }, [userId, token, attempt])

  const listState: WorkoutsState = list?.userId === userId && list.token === token ? list.state : { status: 'loading' }
  const selectable = listState.status === 'success' && Boolean(id && listState.workouts.some((workout) => workout.id === id))

  useEffect(() => {
    setResult(null)
    if (!id || !validWorkoutId(id) || !selectable) return
    return startStatsDetailRequest(userId, token, id, (state) => setResult({ userId, token, id, state }))
  }, [userId, token, id, selectable, attempt])

  const state: StatsDetailState = result?.userId === userId && result.token === token && result.id === id
    ? result.state : { status: 'loading' }

  async function loginAgain() {
    try { await signOut(); navigate(authPath('login', id && validWorkoutId(id) ? `/stats/detail/${id}` : '/stats/detail'), true) }
    catch { setLoginError('Väljalogimine ebaõnnestus. Proovi uuesti.') }
  }

  const failure = listState.status === 'error' || listState.status === 'unauthenticated' ? listState
    : selectable && state.status !== 'loading' && state.status !== 'success' ? state : null

  return (
    <div className="app">
      <Header />
      <ProtectedNavigation navigate={navigate} current="/stats" />
      <main aria-labelledby="stats-detail-title">
        <h1 id="stats-detail-title">Detailne statistika</h1>
        <RouteLink href="/stats" navigate={navigate}>← Tagasi kalendrisse</RouteLink>
        {listState.status === 'loading' ? <p role="status">Laadin treeninguid…</p>
          : listState.status === 'success' && <>
            {!listState.workouts.length ? <p role="status">Statistika vaatamiseks pole veel treeninguid.</p> : (
              <div className="login-field stats-selector">
                <label htmlFor="stats-workout">Vali treening</label>
                <select id="stats-workout" value={selectable ? id! : ''} onChange={(event) =>
                  navigate(event.target.value ? `/stats/detail/${encodeURIComponent(event.target.value)}` : '/stats/detail')}>
                  <option value="">Vali treening</option>
                  {listState.workouts.map((workout) => <option value={workout.id} key={workout.id}>
                    {workout.name} — {formatWorkoutDate(workout.date)}
                  </option>)}
                </select>
              </div>
            )}
            {id !== null && (!validWorkoutId(id) ? <p className="login-error" role="alert">Treeningu ID on vigane.</p>
              : !selectable ? <p role="status">Treeningut ei leitud sinu treeningute hulgast.</p>
                : state.status === 'loading' ? <p role="status">Laadin statistikat…</p>
                  : state.status === 'success' && <StatsDetailContent stats={state.stats} />)}
          </>}
        {failure && <>
          <p className="login-error" role="alert">{failure.message}</p>
          {failure.status === 'unauthenticated'
            ? <button className="auth-navigation" onClick={() => { void loginAgain() }}>Logi uuesti sisse</button>
            : <button className="auth-navigation" onClick={() => setAttempt((value) => value + 1)}>Proovi uuesti</button>}
        </>}
        {loginError && <p className="login-error" role="alert">{loginError}</p>}
      </main>
    </div>
  )
}
