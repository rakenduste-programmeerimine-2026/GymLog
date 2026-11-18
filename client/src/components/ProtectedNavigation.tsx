import RouteLink from './RouteLink'
import { protectedPages } from '../lib/routes'
import type { ProtectedPath } from '../lib/routes'
import type { Navigate } from '../lib/navigation'

export default function ProtectedNavigation({ navigate, current }: {
  navigate: Navigate
  current?: ProtectedPath
}) {
  return (
    <nav className="protected-navigation" aria-label="Põhinavigatsioon">
      {Object.entries(protectedPages).map(([path, title]) => (
        <RouteLink key={path} href={path} navigate={navigate} current={current === path}>
          {title}
        </RouteLink>
      ))}
    </nav>
  )
}
