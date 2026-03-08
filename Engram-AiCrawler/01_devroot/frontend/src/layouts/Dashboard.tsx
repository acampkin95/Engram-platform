import { type ReactNode, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import AppHeader from '../components/AppHeader';
import OfflineBanner from '../components/OfflineBanner';

interface DashboardProps {
  children: ReactNode;
}

export default function Dashboard({ children }: DashboardProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved !== null) {
      setSidebarCollapsed(saved === 'true');
    }
  }, []);

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      localStorage.setItem('sidebar-collapsed', String(!prev));
      return !prev;
    });
  };

  const handleMobileMenuClick = () => {
    setMobileMenuOpen((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-void">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-cyan focus:text-void focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      <OfflineBanner />

      <Sidebar collapsed={sidebarCollapsed} onToggle={handleToggleSidebar} />

      <AppHeader onMenuClick={handleMobileMenuClick} sidebarCollapsed={sidebarCollapsed} />

      <motion.main
        id="main-content"
        className="pt-16 min-h-screen transition-all duration-200"
        style={{ marginLeft: sidebarCollapsed ? '64px' : '240px', transition: 'margin-left 0.2s ease' }}
        tabIndex={-1}
      >
        <div className="p-6">
          {children}
        </div>
      </motion.main>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-black/50"
            aria-label="Close menu"
          />
        </div>
      )}
    </div>
  );
}
