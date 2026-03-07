'use client'

import { useEffect } from 'react'

interface ShortcutMap {
  [key: string]: () => void
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return

      // Allow Cmd+Enter even in inputs
      if (e.key === 'Enter') {
        const fn = shortcuts['Enter']
        if (fn) {
          e.preventDefault()
          fn()
        }
        return
      }

      // Skip other shortcuts when focused on input/textarea
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const fn = shortcuts[e.key]
      if (fn) {
        e.preventDefault()
        fn()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts])
}
