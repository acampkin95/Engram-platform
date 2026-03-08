import { useEffect, useCallback } from'react'
import { Keyboard, X } from'lucide-react'
import { type Shortcut } from'../hooks/useKeyboardShortcuts'

interface ShortcutsHelpProps {
 shortcuts: Shortcut[]
 onClose: () => void
}

function formatKey(key: string): string {
 if (key ==='Escape') return'Esc'
 if (key.length === 1) return key.toUpperCase()
 return key
}

function KeyBadge({ shortcut }: { shortcut: Pick<Shortcut,'key' |'ctrl' |'shift' |'alt'> }) {
 const parts: string[] = []
 if (shortcut.ctrl) parts.push('Ctrl')
 if (shortcut.shift) parts.push('Shift')
 if (shortcut.alt) parts.push('Alt')
 parts.push(formatKey(shortcut.key))

 return (
 <div className="flex items-center gap-1">
 {parts.map((part) => (
 <kbd
 key={part}
 className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 text-xs font-mono bg-abyss text-text-dim border border-border"
 >
 {part}
 </kbd>
 ))}
 </div>
 )
}

const CATEGORY_LABELS: Record<string, string> = {
 navigation:'Navigation',
 actions:'Actions',
 system:'System',
}

const CATEGORY_ORDER = ['navigation','actions','system']

export default function ShortcutsHelp({ shortcuts, onClose }: ShortcutsHelpProps) {
 const handleKeyDown = useCallback(
 (e: KeyboardEvent) => {
 if (e.key ==='Escape' || e.key ==='?') {
 e.preventDefault()
 e.stopPropagation()
 onClose()
 }
 },
 [onClose]
 )

 useEffect(() => {
 document.addEventListener('keydown', handleKeyDown)
 return () => document.removeEventListener('keydown', handleKeyDown)
 }, [handleKeyDown])

 const grouped = CATEGORY_ORDER.reduce<Record<string, Shortcut[]>>((acc, cat) => {
 const items = shortcuts.filter((s) => s.category === cat)
 if (items.length > 0) acc[cat] = items
 return acc
 }, {})

 return (
 <div className="fixed inset-0 z-50">
 <div
 className="fixed inset-0 bg-black/50 backdrop-blur-sm"
 onClick={onClose}
 aria-hidden="true"
 />

 <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg">
 <div className="bg-surface border border-border overflow-hidden">
 <div className="flex items-center justify-between px-6 py-4 border-b border-border">
 <div className="flex items-center gap-2">
 <Keyboard size={20} className="text-cyan" />
 <h2 className="text-lg font-semibold text-text">
 Keyboard Shortcuts
 </h2>
 </div>
 <button
 type="button"
 onClick={onClose}
 className="p-1.5 hover:bg-raised transition-colors"
 aria-label="Close shortcuts help"
 >
 <X size={18} className="text-text-mute" />
 </button>
 </div>

 <div className="px-6 py-4 max-h-[60vh] overflow-y-auto space-y-6">
 {CATEGORY_ORDER.map((cat) => {
 const items = grouped[cat]
 if (!items) return null
 return (
 <div key={cat}>
 <h3 className="text-xs font-semibold text-text-mute uppercase tracking-wider mb-3">
 {CATEGORY_LABELS[cat]}
 </h3>
 <div className="space-y-2">
 {items.map((shortcut) => (
 <div
 key={shortcut.key}
 className="flex items-center justify-between py-1.5"
 >
 <span className="text-sm text-text">
 {shortcut.description}
 </span>
 <KeyBadge shortcut={shortcut} />
 </div>
 ))}
 {cat ==='system' && (
 <div className="flex items-center justify-between py-1.5">
 <span className="text-sm text-text">
 Close Modal
 </span>
 <KeyBadge shortcut={{ key:'Escape' }} />
 </div>
 )}
 </div>
 </div>
 )
 })}
 </div>

 <div className="px-6 py-3 border-t border-border bg-void">
 <p className="text-xs text-text-mute text-center">
 Press{''}
 <kbd className="px-1 py-0.5 bg-abyss font-mono text-[10px]">
 ?
 </kbd>{''}
 or{''}
 <kbd className="px-1 py-0.5 bg-abyss font-mono text-[10px]">
 Esc
 </kbd>{''}
 to close
 </p>
 </div>
 </div>
 </div>
 </div>
 )
}
