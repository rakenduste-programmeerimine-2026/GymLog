import Header from '../components/Header'
import ProtectedNavigation from '../components/ProtectedNavigation'
import { protectedPages } from '../lib/routes'
import type { ProtectedPath } from '../lib/routes'
import type { Navigate } from '../lib/navigation'

export default function ProtectedPlaceholderPage({ path, navigate }: {
  path: ProtectedPath
  navigate: Navigate
}) {
  return (
    <div className="app">
      <Header />
      <ProtectedNavigation navigate={navigate} current={path} />
      <main>
        <h1>{protectedPages[path]}</h1>
        <p>Ajutine kohatäide. Selle lehe sisu pole veel teostatud.</p>
      </main>
    </div>
  )
}
