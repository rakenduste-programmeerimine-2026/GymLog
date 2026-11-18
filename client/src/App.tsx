import { useState } from 'react'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import { useAuth } from './context/AuthContext'

export default function App() {
  const { user, error } = useAuth()
  const [authPage, setAuthPage] = useState<'login' | 'register'>('login')

  // Keep registration feedback visible even if SIGNED_IN arrives before signUp resolves.
  if (authPage === 'register') return <RegisterPage onLogin={() => setAuthPage('login')} />
  if (!user) return <LoginPage onRegister={() => setAuthPage('register')} />

  return (
    <>
      <HomePage />
      {error && (
        <p className="app" role="status">{error}</p>
      )}
    </>
  )
}
