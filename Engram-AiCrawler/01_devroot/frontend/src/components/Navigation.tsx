import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { type LucideIcon, Activity, CalendarClock, ChevronDown, Code2, Database, FolderOpen, Globe, HardDrive, Layers, LayoutDashboard, Menu, Network, PlusCircle, Clock, Search, Settings, X } from 'lucide-react';

interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  shortcut?: string
}
import { useCallback, useEffect, useRef, useState } from 'react';
import InvestigationSelector from './investigations/InvestigationSelector';
import NotificationCenter from './NotificationCenter';
import { UserProfile } from './UserProfile';

export default function Navigation() {
  const location = useLocation()
 const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
 const [crawlDropdownOpen, setCrawlDropdownOpen] = useState(false)
 const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false)
 const crawlDropdownRef = useRef<HTMLDivElement>(null)
 const toolsDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (crawlDropdownRef.current && !crawlDropdownRef.current.contains(e.target as Node)) {
        setCrawlDropdownOpen(false)
      }
      if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(e.target as Node)) {
        setToolsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleDropdownKeyDown = useCallback(
    (e: React.KeyboardEvent, dropdownRef: React.RefObject<HTMLDivElement | null>, setOpen: (v: boolean) => void) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        const trigger = dropdownRef.current?.querySelector<HTMLElement>('button')
        trigger?.focus()
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const items = dropdownRef.current?.querySelectorAll<HTMLElement>('a[href]')
        if (!items || items.length === 0) return
        const currentIndex = Array.from(items).findIndex((el) => el === document.activeElement)
        const next = e.key === 'ArrowDown'
          ? (currentIndex + 1) % items.length
          : (currentIndex - 1 + items.length) % items.length
        items[next].focus()
      }
    },
    [],
  )

 const navItems: NavItem[] = [
 { path:'/', label:'Dashboard', icon: LayoutDashboard },
 { path:'/osint', label:'OSINT', icon: Search, shortcut:'O' },
 { path:'/data', label:'Data', icon: Database },
 { path:'/storage', label:'Storage', icon: HardDrive, shortcut:'D' },
 { path:'/graph', label:'Graph', icon: Network, shortcut:'G' },
 { path:'/investigations', label:'Investigations', icon: FolderOpen },
 { path:'/scheduler', label:'Scheduler', icon: CalendarClock, shortcut:'S' },
 { path:'/settings', label:'Settings', icon: Settings, shortcut:',' },
 ]

 const crawlSubItems: NavItem[] = [
 { path:'/crawl/new', label:'New Crawl', icon: PlusCircle, shortcut:'N' },
 { path:'/crawl/active', label:'Active Crawls', icon: Activity },
 { path:'/crawl/history', label:'History', icon: Clock, shortcut:'H' },
 ]

 const toolsSubItems: NavItem[] = [
 { path:'/extraction-builder', label:'Extraction Builder', icon: Code2, shortcut:'E' },
 { path:'/rag', label:'RAG Pipeline', icon: Layers, shortcut:'R' },
 ]

 const isCrawlSectionActive = location.pathname.startsWith('/crawl')
 const isToolsSectionActive = toolsSubItems.some((item) => location.pathname.startsWith(item.path))

 const isActive = (path: string) =>
 path ==='/' ? location.pathname ==='/' : location.pathname.startsWith(path)

 return (
 <nav aria-label="Main navigation" className="fixed top-0 left-0 right-0 z-50 bg-surface border-b border-border">
 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
 <div className="flex items-center justify-between h-16">
 <div className="flex items-center">
 <Link to="/" className="flex-shrink-0">
 <span className="text-xl font-display font-extrabold"><span className="text-text">crawl</span><span className="text-cyan">4</span><span className="text-acid">ai</span></span>
 </Link>
 <div className="hidden sm:block sm:ml-10">
 <div className="flex items-baseline space-x-1">
 {navItems.map((item) => {
 const Icon = item.icon
 return (
  <Link
  key={item.path}
  to={item.path}
  className={`relative ${
  isActive(item.path)
  ?'bg-cyan/10 text-cyan'
  :'text-text hover:bg-raised'
  } px-3 py-2 text-sm font-medium flex items-center gap-2 transition-colors`}
  >
  <Icon size={18} />
  {item.label}
  {item.shortcut && (
  <kbd className="hidden lg:inline text-[10px] font-mono text-text-mute opacity-60">
  {item.shortcut}
  </kbd>
  )}
  {isActive(item.path) && (
    <motion.span
      layoutId="nav-indicator"
      className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan rounded-t-full"
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    />
  )}
  </Link>
 )
 })}

  {/* biome-ignore lint/a11y/noStaticElementInteractions: keyboard delegation for dropdown menu items */}
  <div className="relative" ref={crawlDropdownRef} onKeyDown={(e) => handleDropdownKeyDown(e, crawlDropdownRef, setCrawlDropdownOpen)}>
  <button
  type="button"
  onClick={() => setCrawlDropdownOpen((o) => !o)}
  aria-expanded={crawlDropdownOpen}
  aria-haspopup="true"
  className={`${
  isCrawlSectionActive
  ?'bg-cyan/10 text-cyan'
  :'text-text hover:bg-raised'
  } px-3 py-2 text-sm font-medium flex items-center gap-2 transition-colors`}
  >
  <Globe size={18} />
  Crawl
  <ChevronDown size={14} className={`transition-transform ${crawlDropdownOpen ?'rotate-180' :''}`} />
  </button>

  <AnimatePresence>
  {crawlDropdownOpen && (
  <motion.div
    initial={{ opacity: 0, y: -6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -6 }}
    transition={{ duration: 0.15 }}
    className="absolute top-full left-0 mt-1 w-44 bg-surface border border-border py-1 z-50"
    role="menu"
  >
  {crawlSubItems.map((item) => {
  const Icon = item.icon
  return (
  <Link
  key={item.path}
  to={item.path}
  onClick={() => setCrawlDropdownOpen(false)}
  className={`${
  location.pathname === item.path || (item.path !=='/crawl/new' && location.pathname.startsWith(item.path))
  ?'bg-cyan/10 text-cyan'
  :'text-text hover:bg-raised'
  } flex items-center gap-2.5 px-3 py-2 text-sm transition-colors`}
  >
  <Icon size={15} />
  {item.label}
  {item.shortcut && (
  <kbd className="ml-auto text-[10px] font-mono text-text-mute">
  {item.shortcut}
  </kbd>
  )}
  </Link>
  )
  })}
  </motion.div>
  )}
  </AnimatePresence>

  {/* biome-ignore lint/a11y/noStaticElementInteractions: keyboard delegation for dropdown menu items */}
  <div className="relative" ref={toolsDropdownRef} onKeyDown={(e) => handleDropdownKeyDown(e, toolsDropdownRef, setToolsDropdownOpen)}>
  <button
  type="button"
  onClick={() => setToolsDropdownOpen((o) => !o)}
  aria-expanded={toolsDropdownOpen}
  aria-haspopup="true"
  className={`${
  isToolsSectionActive
  ?'bg-cyan/10 text-cyan'
  :'text-text hover:bg-raised'
  } px-3 py-2 text-sm font-medium flex items-center gap-2 transition-colors`}
  >
  <Code2 size={18} />
  Tools
  <ChevronDown size={14} className={`transition-transform ${toolsDropdownOpen ?'rotate-180' :''}`} />
  </button>

  <AnimatePresence>
  {toolsDropdownOpen && (
  <motion.div
    initial={{ opacity: 0, y: -6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -6 }}
    transition={{ duration: 0.15 }}
    className="absolute top-full left-0 mt-1 w-52 bg-surface border border-border py-1 z-50"
    role="menu"
  >
  {toolsSubItems.map((item) => {
  const Icon = item.icon
  return (
  <Link
  key={item.path}
  to={item.path}
  onClick={() => setToolsDropdownOpen(false)}
  className={`${
  location.pathname.startsWith(item.path)
  ?'bg-cyan/10 text-cyan'
  :'text-text hover:bg-raised'
  } flex items-center gap-2.5 px-3 py-2 text-sm transition-colors`}
  >
  <Icon size={15} />
  {item.label}
  {item.shortcut && (
  <kbd className="ml-auto text-[10px] font-mono text-text-mute">
  {item.shortcut}
  </kbd>
  )}
  </Link>
  )
  })}
  </motion.div>
  )}
  </AnimatePresence>
 </div>
 </div>
 </div>
  </div>
  <div className="hidden sm:flex items-center gap-3">
  <InvestigationSelector />
  <NotificationCenter />
  <UserProfile />
  </div>

 <div className="-mr-2 flex sm:hidden">
 <button
 type="button"
 onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
 className="p-2 hover:bg-raised transition-colors"
 aria-label="Toggle menu"
 >
 {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
 </button>
 </div>
 </div>
 </div>

  {mobileMenuOpen && (
  <div className="sm:hidden border-t border-border">
  <div className="px-2 pt-2 pb-3 space-y-1">
  {navItems.map((item) => {
  const Icon = item.icon
  return (
  <Link
  key={item.path}
  to={item.path}
  onClick={() => setMobileMenuOpen(false)}
  className={`${
  isActive(item.path)
  ?'bg-cyan/10 text-cyan'
  :'text-text hover:bg-raised'
  } px-3 py-3 text-base font-medium flex items-center gap-2 transition-colors min-h-[44px]`}
  >
  <Icon size={18} />
  {item.label}
  </Link>
  )
  })}

  <div className="pt-1 pb-0.5">
  <p className="px-3 text-xs font-semibold text-text-mute uppercase tracking-wider mb-1">
  Crawl
  </p>
  {crawlSubItems.map((item) => {
  const Icon = item.icon
  return (
  <Link
  key={item.path}
  to={item.path}
  onClick={() => setMobileMenuOpen(false)}
  className={`${
  location.pathname === item.path
  ?'bg-cyan/10 text-cyan'
  :'text-text hover:bg-raised'
  } px-3 py-3 text-base font-medium flex items-center gap-2 transition-colors min-h-[44px]`}
  >
  <Icon size={18} />
  {item.label}
  </Link>
  )
  })}
  </div>

  <div className="pt-1 pb-0.5">
  <p className="px-3 text-xs font-semibold text-text-mute uppercase tracking-wider mb-1">
  Tools
  </p>
  {toolsSubItems.map((item) => {
  const Icon = item.icon
  return (
  <Link
  key={item.path}
  to={item.path}
  onClick={() => setMobileMenuOpen(false)}
  className={`${
  location.pathname.startsWith(item.path)
  ?'bg-cyan/10 text-cyan'
  :'text-text hover:bg-raised'
  } px-3 py-3 text-base font-medium flex items-center gap-2 transition-colors min-h-[44px]`}
  >
  <Icon size={18} />
  {item.label}
  </Link>
  )
  })}
  </div>
  </div>
  </div>
  )}
  </div>
  </nav>
  )
}
