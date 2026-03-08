import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  type LucideIcon,
  Activity,
  Briefcase,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Code2,
  Eye,
  FolderOpen,
  Clock,

} from 'lucide-react';
import type { IconType } from 'react-icons';
import {
  FaSpider,
  FaCircleNodes,
  FaLayerGroup,
  FaDatabase,
  FaServer,
  FaGear,
  FaMagnifyingGlass,
} from 'react-icons/fa6';
import { useCallback, useState } from 'react';

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon | IconType;
  shortcut?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { path: '/', label: 'Dashboard', icon: Activity },
      { path: '/osint', label: 'OSINT Operations', icon: FaMagnifyingGlass, shortcut: 'O' },
      { path: '/graph', label: 'Knowledge Graph', icon: FaCircleNodes, shortcut: 'G' },
      { path: '/investigations', label: 'Investigations', icon: FolderOpen },
      { path: '/cases', label: 'Cases', icon: Briefcase },
      { path: '/darkweb', label: 'Dark Web', icon: Eye },
    ],
  },
  {
    label: 'Crawl',
    items: [
      { path: '/crawl/new', label: 'New Crawl', icon: FaSpider, shortcut: 'N' },
      { path: '/crawl/active', label: 'Active Crawls', icon: Activity },
      { path: '/crawl/history', label: 'History', icon: Clock, shortcut: 'H' },
      { path: '/scheduler', label: 'Schedules', icon: CalendarClock, shortcut: 'S' },
    ],
  },
  {
    label: 'Data',
    items: [
      { path: '/data', label: 'Data Management', icon: FaDatabase },
      { path: '/storage', label: 'Storage', icon: FaServer, shortcut: 'D' },
      { path: '/performance', label: 'Performance', icon: Activity },
    ],
  },
  {
    label: 'Tools',
    items: [
      { path: '/extraction-builder', label: 'Extraction Builder', icon: Code2, shortcut: 'E' },
      { path: '/rag', label: 'RAG Pipeline', icon: FaLayerGroup, shortcut: 'R' },
    ],
  },
];

const bottomItems: NavItem[] = [
  { path: '/settings', label: 'Settings', icon: FaGear, shortcut: ',' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const isActive = useCallback(
    (path: string) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)),
    [location.pathname]
  );

  const sidebarVariants = {
    expanded: { width: 240 },
    collapsed: { width: 64 },
  };

  return (
    <motion.aside
      initial={false}
      animate={collapsed ? 'collapsed' : 'expanded'}
      variants={sidebarVariants}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="fixed left-0 top-0 bottom-0 z-40 flex flex-col bg-surface border-r border-border"
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan to-plasma flex items-center justify-center">
            <FaSpider size={16} className="text-void" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="text-lg font-display font-extrabold whitespace-nowrap overflow-hidden"
              >
                <span className="text-text">crawl</span>
                <span className="text-cyan">4</span>
                <span className="text-acid">ai</span>
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-4 mb-1 text-[10px] font-semibold text-text-mute uppercase tracking-widest"
                >
                  {group.label}
                </motion.p>
              )}
            </AnimatePresence>
            <ul className="space-y-0.5 px-2">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                const itemId = item.path;

                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onMouseEnter={() => setHoveredItem(itemId)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={`
                        relative flex items-center gap-3 px-2 py-2.5 transition-all duration-150
                        ${active
                          ? 'bg-cyan/10 text-cyan'
                          : 'text-text-dim hover:text-text hover:bg-raised'
                        }
                        ${collapsed ? 'justify-center' : ''}
                      `}
                    >
                      {/* Active indicator bar */}
                      {active && (
                        <motion.span
                          layoutId="sidebar-indicator"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-cyan rounded-r-full"
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}

                      <Icon size={20} className={active ? 'text-cyan' : ''} />

                      <AnimatePresence>
                        {!collapsed && (
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex-1 text-sm font-medium whitespace-nowrap"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>

                      {/* Shortcut badge */}
                      {item.shortcut && !collapsed && (
                        <kbd className="text-[10px] font-mono text-text-mute bg-void px-1.5 py-0.5">
                          {item.shortcut}
                        </kbd>
                      )}

                      {/* Collapsed tooltip */}
                      {collapsed && hoveredItem === itemId && (
                        <motion.div
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="absolute left-full ml-2 px-2 py-1 bg-raised border border-border text-sm text-text whitespace-nowrap z-50 pointer-events-none"
                        >
                          {item.label}
                          {item.shortcut && (
                            <kbd className="ml-2 text-[10px] font-mono text-text-mute">
                              {item.shortcut}
                            </kbd>
                          )}
                        </motion.div>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-border py-4 px-2">
        <ul className="space-y-0.5">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`
                    flex items-center gap-3 px-2 py-2.5 transition-all duration-150
                    ${active
                      ? 'bg-cyan/10 text-cyan'
                      : 'text-text-dim hover:text-text hover:bg-raised'
                    }
                    ${collapsed ? 'justify-center' : ''}
                  `}
                >
                  <Icon size={20} className={active ? 'text-cyan' : ''} />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-1 text-sm font-medium whitespace-nowrap"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {item.shortcut && !collapsed && (
                    <kbd className="text-[10px] font-mono text-text-mute bg-void px-1.5 py-0.5">
                      {item.shortcut}
                    </kbd>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Collapse Toggle */}
        <button
          type="button"
          onClick={onToggle}
          className="w-full mt-2 flex items-center justify-center gap-2 px-2 py-2 text-text-mute hover:text-text hover:bg-raised transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs"
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}
