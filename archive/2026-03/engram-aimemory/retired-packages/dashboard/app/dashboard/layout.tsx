"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BarChart2,
  Brain,
  Cpu,
  LayoutDashboard,
  Link2,
  Network,
  Search,
  Settings,
  Shield,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { MCPConnectionModal } from "@/components/ui/MCPConnectionModal";
import { useHealth } from "@/hooks/useHealth";
import { MemoryProvider } from "@/lib/memory-context";

// ---------------------------------------------------------------------------
// Nav structure
// ---------------------------------------------------------------------------

const navGroups = [
  {
    label: "Core",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/memories", label: "Memories", icon: Brain },
      { href: "/dashboard/search", label: "Search", icon: Search },
    ],
  },
  {
    label: "Visualize",
    items: [
      { href: "/dashboard/graph", label: "Memory Graph", icon: Network },
      { href: "/dashboard/knowledge-graph", label: "Entity Graph", icon: Link2 },
      { href: "/dashboard/investigation", label: "Investigation", icon: Shield },
    ],
  },
  {
    label: "Analytics",
    items: [
      { href: "/dashboard/analytics/memories", label: "Mem Analytics", icon: TrendingUp },
      { href: "/dashboard/analytics/search", label: "Search Analytics", icon: BarChart2 },
      { href: "/dashboard/analytics/system", label: "System Health", icon: Activity },
    ],
  },
  {
    label: "AI Services",
    items: [
      { href: "/dashboard/models", label: "AI Models", icon: Cpu },
      { href: "/dashboard/decay", label: "Decay Chart", icon: TrendingDown },
    ],
  },
  {
    label: "Config",
    items: [{ href: "/dashboard/settings", label: "Settings", icon: Settings }],
  },
];
// Bottom nav items (mobile only)
const bottomNavItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/dashboard/memories", icon: Brain, label: "Memories" },
  { href: "/dashboard/search", icon: Search, label: "Search" },
  { href: "/dashboard/graph", icon: Network, label: "Graph" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

// ---------------------------------------------------------------------------
// Engram Strata Logo
// ---------------------------------------------------------------------------

function EngramLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {/* Strata bars — 5 memory layers, progressively narrower */}
      <rect x="6" y="10" width="36" height="4" rx="2" fill="#F2A93B" opacity="1" />
      <rect x="10" y="17" width="28" height="4" rx="2" fill="#9B7DE0" opacity="0.9" />
      <rect x="14" y="24" width="20" height="4" rx="2" fill="#2EC4C4" opacity="0.8" />
      <rect x="18" y="31" width="12" height="4" rx="2" fill="#7C5CBF" opacity="0.6" />
      <rect x="22" y="38" width="4" height="4" rx="2" fill="#B87B20" opacity="0.4" />
      {/* Vertical retrieval connector */}
      <line x1="24" y1="6" x2="24" y2="45" stroke="#F2A93B" strokeWidth="1" strokeOpacity="0.35" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Status Banner
// ---------------------------------------------------------------------------

function StatusBanner() {
  const { data: health } = useHealth();
  const [dismissed, setDismissed] = useState(false);
  const [alertsEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("engram_connection_alerts");
    return saved !== null ? saved === "true" : true;
  });

  const degraded = health && (!health.weaviate || !health.redis);

  if (!degraded || dismissed || !alertsEnabled) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 animate-pulse" />
            <span className="font-medium flex-shrink-0">System Degraded</span>
            <span className="text-amber-400/70 truncate hidden sm:block">
              {!health?.weaviate && !health?.redis
                ? "Weaviate and Redis are offline"
                : !health?.weaviate
                  ? "Weaviate is offline"
                  : "Redis is offline"}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/dashboard/analytics/system"
              className="text-xs px-2.5 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/20 transition-colors"
            >
              View System Health
            </Link>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="p-1 rounded hover:bg-amber-500/15 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Sidebar Nav Item
// ---------------------------------------------------------------------------

function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  collapsed: boolean;
}) {
  return (
    <Link href={href} title={collapsed ? label : undefined}>
      <motion.div
        whileHover={{ x: isActive ? 0 : 2 }}
        transition={{ duration: 0.12 }}
        className={clsx(
          "flex items-center gap-3 rounded-lg text-sm font-medium transition-colors duration-150 relative",
          collapsed ? "px-2 py-2.5 justify-center" : "px-3 py-2.5",
          isActive
            ? "bg-gradient-to-r from-[rgba(242,169,59,0.12)] to-transparent text-[#F2A93B]"
            : "text-[#5C5878] hover:text-[#A09BB8] hover:bg-white/[0.04]"
        )}
      >
        <Icon
          className={clsx("w-4 h-4 flex-shrink-0", isActive ? "text-[#F2A93B]" : "text-[#5C5878]")}
        />
        {!collapsed && <span className="truncate">{label}</span>}
        {isActive && !collapsed && (
          <motion.div
            layoutId="activeNav"
            className="absolute inset-0 rounded-lg bg-[rgba(242,169,59,0.04)]"
            transition={{ duration: 0.18 }}
          />
        )}
      </motion.div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function Sidebar({ pathname, onMcpClick }: { pathname: string; onMcpClick?: () => void }) {
  // collapsed on tablet (md), full on lg+
  return (
    <aside className="hidden md:flex w-16 lg:w-64 bg-[#090818] border-r border-white/[0.06] flex-col flex-shrink-0 transition-all duration-300">
      {/* Logo */}
      <div className="px-3 lg:px-5 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <EngramLogo />
          </div>
          <div className="hidden lg:block overflow-hidden">
            <h1
              className="text-base font-bold leading-none tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                color: "#F2A93B",
                letterSpacing: "0.2em",
              }}
            >
              ENGRAM
            </h1>
            <p className="text-[10px] text-[#5C5878] mt-0.5 leading-none font-mono tracking-widest uppercase">
              Multi-Layer Memory System
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 lg:px-3 py-4 space-y-5 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="hidden lg:block text-[10px] text-[#5C5878] uppercase tracking-widest font-mono px-3 mb-1.5">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  isActive={pathname === item.href}
                  collapsed={false}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer — MCP Ready badge */}
      <div className="px-3 py-4 border-t border-white/[0.06]">
        <button
          type="button"
          onClick={onMcpClick}
          className={clsx(
            "flex items-center gap-2 rounded-lg px-3 py-2 w-full transition-colors",
            "bg-[rgba(242,169,59,0.08)] border border-[rgba(242,169,59,0.2)]",
            onMcpClick && "hover:bg-[rgba(242,169,59,0.12)] cursor-pointer"
          )}
        >
          <Zap className="w-3.5 h-3.5 text-[#F2A93B] flex-shrink-0" />
          <span className="hidden lg:block text-xs text-[#F2A93B]/80 font-mono tracking-wider">
            MCP READY
          </span>
        </button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Mobile Bottom Nav
// ---------------------------------------------------------------------------

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-[#090818]/95 backdrop-blur-xl border-t border-white/[0.06] px-2 pb-safe">
      {bottomNavItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex flex-col items-center gap-0.5 px-3 py-3 rounded-lg transition-colors",
              isActive ? "text-[#F2A93B]" : "text-[#5C5878]"
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function DashboardHeader({ pathname }: { pathname: string }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const getPageTitle = () => {
    if (pathname === "/dashboard") return "Overview";
    if (pathname === "/dashboard/memories") return "Memories";
    if (pathname === "/dashboard/search") return "Search";
    if (pathname === "/dashboard/graph") return "Memory Graph";
    if (pathname === "/dashboard/knowledge-graph") return "Entity Graph";
    if (pathname === "/dashboard/settings") return "Settings";
    if (pathname === "/dashboard/analytics/memories") return "Memory Analytics";
    if (pathname === "/dashboard/analytics/search") return "Search Analytics";
    if (pathname === "/dashboard/analytics/system") return "System Health";
    if (pathname === "/dashboard/models") return "AI Models";
    if (pathname === "/dashboard/decay") return "Memory Decay";
    if (pathname.startsWith("/dashboard/analytics")) return "Analytics";
    return "ENGRAM";
  };
  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/dashboard/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  return (
    <header className="h-14 bg-[#090818]/90 backdrop-blur-xl border-b border-white/[0.06] px-4 lg:px-6 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Mobile logo */}
        <div className="md:hidden flex items-center gap-2">
          <EngramLogo />
          <span
            className="text-sm font-semibold"
            style={{
              fontFamily: "var(--font-display)",
              color: "#F2A93B",
              letterSpacing: "0.2em",
              fontSize: "0.85rem",
            }}
          >
            ENGRAM
          </span>
        </div>
        <h2 className="hidden md:block text-sm font-semibold text-[#f0eef8]">{getPageTitle()}</h2>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5c5878]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search memories..."
            className="w-40 sm:w-52 pl-9 pr-4 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-[#A09BB8] placeholder-[#5C5878] focus:outline-none focus:border-[rgba(242,169,59,0.4)] focus:ring-1 focus:ring-[rgba(242,169,59,0.2)] transition-all font-mono"
          />
        </div>

        {/* System status dot */}
        <SystemStatusDot />
      </div>
    </header>
  );
}

function SystemStatusDot() {
  const { data: health } = useHealth();
  const online = health?.weaviate && health?.redis;

  return (
    <div className="flex items-center gap-1.5">
      <motion.div
        className={clsx(
          "w-2 h-2 rounded-full",
          online ? "bg-[#2ec4c4]" : health ? "bg-amber-400" : "bg-[#5c5878]"
        )}
        animate={
          online
            ? {
                boxShadow: [
                  "0 0 4px rgba(46,196,196,0.5)",
                  "0 0 10px rgba(46,196,196,0.9)",
                  "0 0 4px rgba(46,196,196,0.5)",
                ],
              }
            : {}
        }
        transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
      />
      <span
        className={clsx(
          "text-xs font-medium hidden sm:block",
          online ? "text-[#2ec4c4]" : "text-[#F2A93B]"
        )}
      >
        {online ? "Online" : health ? "Degraded" : "Connecting..."}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mcpModalOpen, setMcpModalOpen] = useState(false);

  return (
    <MemoryProvider>
      <div className="flex flex-col min-h-screen" style={{ background: "#03020a" }}>
        {/* Status banner (full width, above everything) */}
        <StatusBanner />

        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <Sidebar pathname={pathname} onMcpClick={() => setMcpModalOpen(true)} />

          {/* Main */}
          <div className="flex-1 flex flex-col min-w-0">
            <DashboardHeader pathname={pathname} />
            <main className="flex-1 p-4 lg:p-6 overflow-auto pb-20 md:pb-6">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={pathname}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="h-full"
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </div>

        {/* Mobile bottom nav */}
        <BottomNav pathname={pathname} />
        <MCPConnectionModal isOpen={mcpModalOpen} onClose={() => setMcpModalOpen(false)} />
      </div>
    </MemoryProvider>
  );
}
