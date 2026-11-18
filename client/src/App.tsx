import HomePage from './pages/HomePage'
import { useAuth } from './context/AuthContext'

export default function App() {
  const { configurationError, error } = useAuth()

  return (
    <>
      <HomePage />
      {(configurationError || error) && (
        <p className="app" role="status">{configurationError ?? error}</p>
      )}
    </>
  )
}
