import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import { useAuth } from './context/AuthContext'

export default function App() {
  const { user, error } = useAuth()

  if (!user) return <LoginPage />

  return (
    <>
      <HomePage />
      {error && (
        <p className="app" role="status">{error}</p>
      )}
    </>
  )
}
