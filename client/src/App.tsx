import { useEffect } from 'react'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ProtectedPlaceholderPage from './pages/ProtectedPlaceholderPage'
import WorkoutsPage from './pages/WorkoutsPage'
import ProtectedNavigation from './components/ProtectedNavigation'
import Header from './components/Header'
import RouteLink from './components/RouteLink'
import { useAuth } from './context/AuthContext'
import { authPath, resolveRoute } from './lib/routes'
import { navigate, usePath } from './lib/navigation'
import type { Navigate } from './lib/navigation'

export default function App() {
  const path = usePath()
  return <AppRoutes path={path} navigate={navigate} />
}

export function AppRoutes({ path, navigate }: { path: string; navigate: Navigate }) {
  const { user, session, loading, configurationError, error } = useAuth()
  const route = resolveRoute(path, {
    loading,
    authenticated: Boolean(user && session && !configurationError),
  })
  const redirectTo = route.kind === 'redirect' ? route.to : null

  useEffect(() => {
    if (redirectTo) navigate(redirectTo, true)
  }, [redirectTo, navigate])

  if (route.kind === 'loading' || route.kind === 'redirect') {
    return (
      <div className="app">
        <Header />
        <main><p role="status">{route.kind === 'loading' ? 'Laadin sessiooni…' : 'Suunan edasi…'}</p></main>
      </div>
    )
  }
  if (route.kind === 'login') {
    return <LoginPage onRegister={() => navigate(authPath('register', route.destination))} />
  }
  if (route.kind === 'register') {
    return <RegisterPage onLogin={() => navigate(authPath('login', route.destination))} />
  }
  if (route.kind === 'not-found') {
    return (
      <div className="app">
        <Header />
        <main>
          <h1>Lehte ei leitud</h1>
          <RouteLink href="/" navigate={navigate}>Tagasi avalehele</RouteLink>
        </main>
      </div>
    )
  }

  return (
    <>
      {route.kind === 'protected' ? (
        route.path === '/workouts' && new URL(path, 'https://gymlog.invalid').pathname.replace(/\/$/, '') === '/workouts' ? (
          <WorkoutsPage key={user?.id} navigate={navigate} />
        ) : (
          <ProtectedPlaceholderPage path={route.path} navigate={navigate} />
        )
      ) : (
        <>
          <HomePage />
          <div className="app"><ProtectedNavigation navigate={navigate} /></div>
        </>
      )}
      {error && (
        <p className="app" role="status">{error}</p>
      )}
    </>
  )
}
