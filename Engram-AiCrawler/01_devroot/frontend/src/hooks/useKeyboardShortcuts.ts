import { useEffect, useCallback } from 'react'

export interface Shortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  action: () => void
  description: string
  category?: 'navigation' | 'actions' | 'system'
}

export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return

      const active = document.activeElement
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        active?.getAttribute('contenteditable') === 'true'
      ) {
        return
      }

      for (const shortcut of shortcuts) {
        const hasModifier = shortcut.ctrl || shortcut.shift || shortcut.alt

        if (hasModifier) {
          const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
          const ctrlMatch = shortcut.ctrl
            ? event.ctrlKey || event.metaKey
            : !event.ctrlKey && !event.metaKey
          const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey
          const altMatch = shortcut.alt ? event.altKey : !event.altKey

          if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
            event.preventDefault()
            shortcut.action()
            return
          }
        } else {
          if (event.key === shortcut.key && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault()
            shortcut.action()
            return
          }
        }
      }
    },
    [shortcuts, enabled]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
