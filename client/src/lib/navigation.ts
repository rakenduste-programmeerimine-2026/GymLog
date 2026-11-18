import { useSyncExternalStore } from 'react'

export type Navigate = (path: string, replace?: boolean) => void

function currentPath() {
  return window.location.pathname + window.location.search
}

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}

export const navigate: Navigate = (path, replace = false) => {
  if (path === currentPath()) return
  if (replace) window.history.replaceState(null, '', path)
  else window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function usePath() {
  return useSyncExternalStore(subscribe, currentPath, () => '/')
}
