"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { kbArticles } from "@/app/lib/kb-data";

interface Category {
  id: string;
  label: string;
  color: string;
  articles: typeof kbArticles;
}

export default function KBLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({
    architecture: true,
    guides: true,
    api: false,
    deployment: false,
    security: false,
  });
  const [activePath, setActivePath] = useState<string | null>(null);

  const categories: Category[] = [
    {
      id: "architecture",
      label: "Architecture",
      color: "--engram-amber",
      articles: kbArticles.filter((a) => a.category === "architecture"),
    },
    {
      id: "guides",
      label: "Guides",
      color: "--engram-amber",
      articles: kbArticles.filter((a) => a.category === "guides"),
    },
    {
      id: "api",
      label: "API Reference",
      color: "--engram-violet",
      articles: kbArticles.filter((a) => a.category === "api"),
    },
    {
      id: "deployment",
      label: "Deployment",
      color: "--engram-teal",
      articles: kbArticles.filter((a) => a.category === "deployment"),
    },
    {
      id: "security",
      label: "Security",
      color: "--engram-rose",
      articles: kbArticles.filter((a) => a.category === "security"),
    },
  ];

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  return (
    <div className="flex min-h-screen bg-[var(--void)]">
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed left-4 top-4 z-40 lg:hidden p-2 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors duration-200"
        aria-label={sidebarOpen ? "Close menu" : "Open menu"}
      >
        {sidebarOpen ? (
          <X size={20} />
        ) : (
          <Menu size={20} />
        )}
      </button>

      {/* Sidebar - Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full w-60 bg-[var(--layer-0)] border-r border-[var(--border)] overflow-y-auto transition-transform duration-300 lg:relative lg:translate-x-0 z-30 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 sticky top-0 bg-[var(--layer-0)] border-b border-[var(--border)]">
          <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            Knowledge Base
          </h2>
        </div>

        <nav className="p-6 space-y-1">
          {categories.map((category) => (
            <div key={category.id}>
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-1)] transition-all duration-200 group"
              >
                <span className="flex-1 text-left">{category.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--text-muted)] bg-[var(--surface-1)] px-2 py-1 rounded-full group-hover:bg-[var(--surface-2)] transition-colors duration-200">
                    {category.articles.length}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-[var(--text-muted)] transition-transform duration-300 ${
                      expandedCategories[category.id] ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {/* Expandable category articles - Smooth animation */}
              <div
                className="overflow-hidden transition-all duration-300 ease-out"
                style={{
                  maxHeight: expandedCategories[category.id]
                    ? `${category.articles.length * 40 + 8}px`
                    : "0px",
                }}
              >
                <div className="ml-2 mt-2 space-y-1 border-l border-[var(--border)] pl-4">
                  {category.articles.map((article) => (
                    <Link
                      key={article.slug}
                      href={`/knowledge-base/${article.slug}`}
                      className="block px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-200 rounded-lg hover:bg-[var(--surface-1)] relative group"
                      onClick={() => setActivePath(article.slug)}
                    >
                      {/* Active indicator - amber left border */}
                      {activePath === article.slug && (
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--engram-amber)] rounded-r transition-all duration-300" />
                      )}
                      <span className={activePath === article.slug ? "text-[var(--engram-amber)]" : ""}>
                        {article.title}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 w-full">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb - Enhanced styling */}
          <nav
            className="flex items-center gap-2 text-sm mb-8 pb-6 border-b border-[var(--border)]"
            aria-label="Breadcrumb"
          >
            <Link
              href="/"
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors duration-200 font-mono"
            >
              Home
            </Link>
            <span className="text-[var(--text-muted)]">/</span>
            <Link
              href="/knowledge-base"
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors duration-200 font-mono"
            >
              Knowledge Base
            </Link>
            <span className="text-[var(--text-muted)]">/</span>
            <span className="text-[var(--text-primary)] font-mono font-semibold">
              Article
            </span>
          </nav>

          {children}
        </div>
      </main>
    </div>
  );
}
