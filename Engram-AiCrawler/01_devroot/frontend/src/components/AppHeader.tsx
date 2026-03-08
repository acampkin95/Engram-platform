import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuSearch, LuMenu, LuX } from 'react-icons/lu';
import InvestigationSelector from './investigations/InvestigationSelector';
import NotificationCenter from './NotificationCenter';
import { UserProfile } from './UserProfile';

interface AppHeaderProps {
  onMenuClick: () => void;
  sidebarCollapsed: boolean;
}

export default function AppHeader({ onMenuClick, sidebarCollapsed }: AppHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header
      className="fixed top-0 right-0 z-30 h-16 bg-surface border-b border-border flex items-center justify-between px-4"
      style={{ left: sidebarCollapsed ? 64 : 240 }}
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-raised transition-colors"
          aria-label="Toggle sidebar"
        >
          <LuMenu size={20} />
        </button>

        <AnimatePresence mode="wait">
          {searchOpen ? (
            <motion.div
              key="search-input"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 320 }}
              exit={{ opacity: 0, width: 0 }}
              className="relative"
            >
              <LuSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-mute" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search crawls, entities, URLs..."
                className="w-full pl-10 pr-10 py-2 bg-void border border-border text-sm text-text placeholder:text-text-mute focus:outline-none focus:border-cyan transition-colors"
              />
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false);
                  setSearchQuery('');
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-mute hover:text-text transition-colors"
              >
                <LuX size={16} />
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="search-button"
              type="button"
              onClick={() => setSearchOpen(true)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-void border border-border text-text-mute text-sm hover:border-border-hi transition-colors"
            >
              <LuSearch size={16} />
              <span>Search...</span>
              <kbd className="hidden md:inline text-[10px] font-mono bg-raised px-1.5 py-0.5">
                ⌘K
              </kbd>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="sm:hidden p-2 hover:bg-raised transition-colors"
          aria-label="Search"
        >
          <LuSearch size={20} />
        </button>

        <InvestigationSelector />
        <NotificationCenter />
        <UserProfile />
      </div>
    </header>
  );
}
