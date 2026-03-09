"use client";

import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();

  const getPageTitle = () => {
    switch (pathname) {
      case "/":
        return "Dashboard";
      case "/memories":
        return "Memories";
      case "/search":
        return "Search";
      case "/graph":
        return "Knowledge Graph";
      case "/settings":
        return "Settings";
      default:
        return "AI Memory System";
    }
  };

  return (
    <header className="h-14 bg-slate-800 border-b border-slate-700 px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">{getPageTitle()}</h2>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search memories..."
            className="w-64 px-4 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm focus:outline-none focus:border-primary-500"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">⌘K</span>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm text-slate-400">System Online</span>
        </div>
      </div>
    </header>
  );
}
