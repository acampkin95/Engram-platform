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
        className="fixed left-4 top-4 z-40 lg:hidden p-2 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
      >
        {sidebarOpen ? (
          <X size={20} />
        ) : (
          <Menu size={20} />
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full w-60 bg-[var(--layer-0)] border-r border-[var(--border)] overflow-y-auto transition-transform duration-300 lg:relative lg:translate-x-0 z-30 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6">
          <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-8">
            Knowledge Base
          </h2>

          <nav className="space-y-1">
            {categories.map((category) => (
              <div key={category.id}>
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-1)] transition-colors"
                >
                  <span>{category.label}</span>
                  <span className="text-xs text-[var(--text-muted)] bg-[var(--surface-1)] px-2 py-1 rounded">
                    {category.articles.length}
                  </span>
                </button>

                {expandedCategories[category.id] && (
                  <div className="ml-2 mt-1 space-y-1 border-l border-[var(--border)] pl-4">
                    {category.articles.map((article) => (
                      <Link
                        key={article.slug}
                        href={`/knowledge-base/${article.slug}`}
                        className="block px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-lg hover:bg-[var(--surface-1)]"
                      >
                        {article.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 w-full">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mb-8">
            <Link href="/" className="hover:text-[var(--text-primary)]">
              Home
            </Link>
            <span>/</span>
            <Link
              href="/knowledge-base"
              className="hover:text-[var(--text-primary)]"
            >
              Knowledge Base
            </Link>
            <span>/</span>
            <span className="text-[var(--text-primary)]">
              Article
            </span>
          </nav>

          {children}
        </div>
      </main>
    </div>
  );
}
