import { useEffect, useState } from 'react'
import Header from '../components/Header'
import ProtectedNavigation from '../components/ProtectedNavigation'
import WorkoutCalendar from '../components/WorkoutCalendar'
import { useAuth } from '../context/AuthContext'
import { localToday, monthLabel, shiftMonth, startCalendarRequest } from '../lib/calendar'
import type { CalendarState } from '../lib/calendar'
import { authPath } from '../lib/routes'
import type { Navigate } from '../lib/navigation'

export function CalendarContent({ state, month, today, selected, onSelect, onRetry, onLogin }: {
  state: CalendarState; month: string; today: string; selected: string | null
  onSelect: (date: string) => void; onRetry: () => void; onLogin: () => void
}) {
  if (state.status === 'loading') return <p role="status">Laadin kalendrit…</p>
  if (state.status !== 'success') return (
    <div>
      <p className="login-error" role="alert">{state.message}</p>
      {state.status === 'unauthenticated'
        ? <button className="auth-navigation" onClick={onLogin}>Logi uuesti sisse</button>
        : <button className="auth-navigation" onClick={onRetry}>Proovi uuesti</button>}
    </div>
  )
  return (
    <>
      {!Object.values(state.activity).some(Boolean) && <p role="status">Sel kuul pole treeninguid.</p>}
      <WorkoutCalendar month={month} activity={state.activity} today={today} selected={selected} onSelect={onSelect} />
    </>
  )
}

export default function StatsCalendarPage({ navigate }: { navigate: Navigate }) {
  const { user, session, signOut } = useAuth()
  const userId = user?.id ?? ''
  const token = session?.access_token ?? ''
  const [today, setToday] = useState(localToday)
  const [month, setMonth] = useState(() => today.slice(0, 7))
  const [selected, setSelected] = useState<string | null>(today)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ userId: string; token: string; month: string; state: CalendarState } | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setToday(localToday()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    setResult(null)
    return startCalendarRequest(userId, token, month, (state) => setResult({ userId, token, month, state }))
  }, [userId, token, month, attempt])

  const state: CalendarState = result?.userId === userId && result.token === token && result.month === month
    ? result.state : { status: 'loading' }
  const previous = shiftMonth(month, -1)
  const next = shiftMonth(month, 1)

  function changeMonth(value: string) {
    setMonth(value)
    setSelected(value === today.slice(0, 7) ? today : `${value}-01`)
  }

  async function loginAgain() {
    try { await signOut(); navigate(authPath('login', '/stats'), true) }
    catch { setResult({ userId, token, month, state: { status: 'error', message: 'Väljalogimine ebaõnnestus. Proovi uuesti.' } }) }
  }

  return (
    <div className="app calendar-page">
      <Header />
      <ProtectedNavigation navigate={navigate} current="/stats" />
      <main aria-labelledby="calendar-title">
        <h1 id="calendar-title">Treeningukalender</h1>
        <div className="calendar-controls">
          <button className="calendar-month-button" aria-label="Eelmine kuu" disabled={!previous}
            onClick={() => previous && changeMonth(previous)}>‹</button>
          <h2 aria-live="polite" aria-atomic="true">{monthLabel(month)}
            {month === today.slice(0, 7) && <span className="calendar-current-month">Käesolev kuu</span>}
          </h2>
          <button className="calendar-month-button" aria-label="Järgmine kuu" disabled={!next}
            onClick={() => next && changeMonth(next)}>›</button>
        </div>
        <button className="auth-navigation" disabled={month === today.slice(0, 7)}
          onClick={() => changeMonth(today.slice(0, 7))}>Käesolevasse kuusse</button>
        <CalendarContent state={state} month={month} today={today} selected={selected} onSelect={setSelected}
          onRetry={() => { setResult(null); setAttempt((value) => value + 1) }} onLogin={() => { void loginAgain() }} />
      </main>
    </div>
  )
}
