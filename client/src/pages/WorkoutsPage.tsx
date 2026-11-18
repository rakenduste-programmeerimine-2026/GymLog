import { useEffect, useState } from 'react'
import Header from '../components/Header'
import ProtectedNavigation from '../components/ProtectedNavigation'
import { useAuth } from '../context/AuthContext'
import { formatWorkoutDate, startWorkoutsRequest } from '../lib/workouts'
import type { WorkoutsState } from '../lib/workouts'
import { authPath } from '../lib/routes'
import type { Navigate } from '../lib/navigation'

export function WorkoutsContent({ state, onRetry, onLogin }: {
  state: WorkoutsState
  onRetry: () => void
  onLogin: () => void
}) {
  if (state.status === 'loading') return <p role="status">Laadin treeninguid…</p>
  if (state.status === 'error' || state.status === 'unauthenticated') {
    return (
      <div>
        <p className="login-error" role="alert">{state.message}</p>
        {state.status === 'unauthenticated' ? (
          <button className="login-submit" onClick={onLogin}>Logi uuesti sisse</button>
        ) : (
          <button className="login-submit" onClick={onRetry}>Proovi uuesti</button>
        )}
      </div>
    )
  }
  if (state.workouts.length === 0) {
    return <p role="status">Sul pole veel salvestatud treeninguid. Uue treeningu lisamise vorm pole veel saadaval.</p>
  }
  return (
    <>
      <p className="workouts-summary" role="status">Treeninguid: {state.workouts.length}. Uuemad eespool.</p>
      <ul className="workouts-list">
        {state.workouts.map((workout) => (
          <li className="workout-card" key={workout.id}>
            <h2>{workout.name}</h2>
            <time dateTime={workout.date}>{formatWorkoutDate(workout.date)}</time>
            <p className="workout-detail-note">Treeningu detailvaade pole veel saadaval.</p>
          </li>
        ))}
      </ul>
    </>
  )
}

export default function WorkoutsPage({ navigate }: { navigate: Navigate }) {
  const { user, session, signOut } = useAuth()
  const userId = user?.id ?? ''
  const token = session?.access_token ?? ''
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ userId: string; token: string; state: WorkoutsState } | null>(null)

  useEffect(() => {
    setResult(null)
    if (!userId || !token) return
    return startWorkoutsRequest(userId, token, (state) => {
      setResult({ userId, token, state })
    })
  }, [userId, token, attempt])

  let state: WorkoutsState = { status: 'loading' }
  if (!userId || !token) state = { status: 'unauthenticated', message: 'Treeningute vaatamiseks logi sisse.' }
  else if (result?.userId === userId && result.token === token) state = result.state

  async function loginAgain() {
    setResult(null)
    try {
      await signOut()
      navigate(authPath('login', '/workouts'), true)
    } catch {
      setResult({ userId, token, state: { status: 'error', message: 'Väljalogimine ebaõnnestus. Proovi uuesti.' } })
    }
  }

  return (
    <div className="app">
      <Header />
      <ProtectedNavigation navigate={navigate} current="/workouts" />
      <main aria-labelledby="workouts-title">
        <h1 id="workouts-title">Minu treeningud</h1>
        <WorkoutsContent state={state} onRetry={() => { setResult(null); setAttempt((value) => value + 1) }}
          onLogin={() => { void loginAgain() }} />
      </main>
    </div>
  )
}
