import type { ReactNode } from 'react'
import type { Navigate } from '../lib/navigation'

export default function RouteLink({ href, navigate, children, current = false }: {
  href: string
  navigate: Navigate
  children: ReactNode
  current?: boolean
}) {
  return (
    <a className="auth-navigation" href={href} aria-current={current ? 'page' : undefined}
      onClick={(event) => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        navigate(href)
      }}>
      {children}
    </a>
  )
}
