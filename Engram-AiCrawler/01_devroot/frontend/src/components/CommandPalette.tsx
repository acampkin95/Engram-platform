import { useCallback, useEffect, useMemo, useRef, useState } from'react'
import { useNavigate } from'react-router-dom'
import {
  Activity,
  CalendarClock,
  Code2,
  Clock,
  Globe2,
  HardDrive,
  Layers,
  LayoutDashboard,
  Mail,
  Network,
  PlusCircle,
  Search,
  Settings,
  Shield,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface PaletteCommand {
 id: string
 name: string
 description: string
 icon: LucideIcon
 shortcut?: string
 action: () => void
}

export function CommandPalette() {
 const [open, setOpen] = useState(false)
 const [query, setQuery] = useState('')
 const [selectedIndex, setSelectedIndex] = useState(0)
 const inputRef = useRef<HTMLInputElement>(null)
 const listRef = useRef<HTMLDivElement>(null)
 const navigate = useNavigate()

  const commands: PaletteCommand[] = useMemo(
    () => [
      { id: 'new-crawl', name: 'New Crawl', description: 'Start a new web crawl', icon: PlusCircle, shortcut: 'N', action: () => navigate('/crawl/new') },
      { id: 'crawl-history', name: 'Crawl History', description: 'View past crawl results', icon: Clock, shortcut: 'H', action: () => navigate('/crawl/history') },
      { id: 'osint', name: 'OSINT Dashboard', description: 'Open source intelligence tools', icon: Search, shortcut: 'O', action: () => navigate('/osint') },
      { id: 'osint-whois', name: 'WHOIS Lookup', description: 'Domain & DNS intelligence', icon: Globe2, action: () => { navigate('/osint'); /* tab state will be set by URL param in future */ } },
      { id: 'osint-threat', name: 'Threat Intel', description: 'IP reputation & vulnerability scan', icon: Shield, action: () => { navigate('/osint'); } },
      { id: 'osint-email', name: 'Email OSINT', description: 'Breach check & email verification', icon: Mail, action: () => { navigate('/osint'); } },
      { id: 'knowledge-graph', name: 'Knowledge Graph', description: 'Explore entity relationships', icon: Network, shortcut: 'G', action: () => navigate('/graph') },
      { id: 'extraction', name: 'Extraction Builder', description: 'Build data extraction schemas', icon: Code2, shortcut: 'E', action: () => navigate('/extraction-builder') },
      { id: 'rag', name: 'RAG Pipeline', description: 'Retrieval-augmented generation', icon: Layers, shortcut: 'R', action: () => navigate('/rag') },
      { id: 'scheduler', name: 'Scheduler', description: 'Schedule recurring crawls', icon: CalendarClock, shortcut: 'S', action: () => navigate('/scheduler') },
{ id: 'storage', name: 'Storage', description: 'Manage data storage and collections', icon: HardDrive, shortcut: 'D', action: () => navigate('/storage') },
      { id: 'performance', name: 'Performance', description: 'System health, storage tiers, job queue', icon: Activity, shortcut: 'P', action: () => navigate('/performance') },
      { id: 'settings', name: 'Settings', description: 'Application preferences', icon: Settings, shortcut: ',', action: () => navigate('/settings') },
      { id: 'dashboard', name: 'Go to Dashboard', description: 'Return to main dashboard', icon: LayoutDashboard, shortcut: 'Home', action: () => navigate('/') },
    ],
    [navigate],
  )

 const filtered = useMemo(() => {
 if (!query) return commands
 const lower = query.toLowerCase()
 return commands.filter(
 (cmd) =>
 cmd.name.toLowerCase().includes(lower) ||
 cmd.description.toLowerCase().includes(lower)
 )
 }, [query, commands])

 useEffect(() => {
 const handleGlobalKeyDown = (e: KeyboardEvent) => {
 if ((e.metaKey || e.ctrlKey) && e.key ==='k') {
 e.preventDefault()
 setOpen((prev) => !prev)
 }
 }
 document.addEventListener('keydown', handleGlobalKeyDown)
 return () => document.removeEventListener('keydown', handleGlobalKeyDown)
 }, [])

 useEffect(() => {
 if (open) {
 setQuery('')
 setSelectedIndex(0)
 requestAnimationFrame(() => inputRef.current?.focus())
 }
 }, [open])

 const executeCommand = useCallback(
 (index: number) => {
 const cmd = filtered[index]
 if (cmd) {
 cmd.action()
 setOpen(false)
 }
 },
 [filtered]
 )

 useEffect(() => {
 if (!listRef.current) return
 const items = listRef.current.querySelectorAll('[data-command-item]')
 items[selectedIndex]?.scrollIntoView({ block:'nearest' })
 }, [selectedIndex])

 const handleKeyDown = useCallback(
 (e: React.KeyboardEvent) => {
 switch (e.key) {
 case'ArrowDown':
 e.preventDefault()
 if (filtered.length > 0) {
 setSelectedIndex((prev) => (prev + 1) % filtered.length)
 }
 break
 case'ArrowUp':
 e.preventDefault()
 if (filtered.length > 0) {
 setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length)
 }
 break
 case'Enter':
 e.preventDefault()
 executeCommand(selectedIndex)
 break
 case'Escape':
 e.preventDefault()
 setOpen(false)
 break
 }
 },
 [filtered.length, selectedIndex, executeCommand]
 )

 if (!open) return null

 return (
 <div
 className="fixed inset-0 z-[100]"
 role="dialog"
 aria-modal="true"
 aria-label="Command palette"
 >
 <button
 type="button"
 className="fixed inset-0 w-full h-full bg-black/50 backdrop-blur-sm cursor-default"
 onClick={() => setOpen(false)}
 aria-label="Close command palette"
 tabIndex={-1}
 />
 <div className="fixed inset-0 flex items-start justify-center pt-[20vh] pointer-events-none">
 <div
 className="relative w-full max-w-lg mx-4 bg-void border border-border overflow-hidden pointer-events-auto"
 >
 <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
 <Search size={18} className="text-text-mute flex-shrink-0" />
 <input
 ref={inputRef}
 type="text"
 value={query}
 onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0) }}
 onKeyDown={handleKeyDown}
 placeholder="Type a command..."
 className="flex-1 bg-transparent text-text placeholder-text-mute outline-none text-sm"
 />
 <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-text-mute bg-abyss border border-border">
 Esc
 </kbd>
 </div>

 <div ref={listRef} className="max-h-72 overflow-y-auto py-2" role="listbox">
 {filtered.length === 0 ? (
 <p className="px-4 py-6 text-center text-sm text-text-dim">
 No results found
 </p>
 ) : (
 filtered.map((cmd, index) => {
 const Icon = cmd.icon
 return (
 <button
 key={cmd.id}
 type="button"
 data-command-item
 role="option"
 aria-selected={index === selectedIndex}
 onClick={() => executeCommand(index)}
 onMouseEnter={() => setSelectedIndex(index)}
 className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
 index === selectedIndex
 ?'bg-cyan/10 text-cyan'
 :'text-text hover:bg-void'
 }`}
 >
 <Icon size={18} className="flex-shrink-0" />
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium truncate">{cmd.name}</p>
 <p className="text-xs text-text-dim truncate">
 {cmd.description}
 </p>
 </div>
 {cmd.shortcut && (
 <kbd className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium text-text-mute bg-abyss border border-border">
 {cmd.shortcut}
 </kbd>
 )}
 </button>
 )
 })
 )}
 </div>
 </div>
 </div>
 </div>
 )
}
