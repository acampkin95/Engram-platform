"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, BookOpen } from "lucide-react";
import { kbArticles } from "@/app/lib/kb-data";

const colorMap = {
  amber: "--engram-amber",
  violet: "--engram-violet",
  teal: "--engram-teal",
  rose: "--engram-rose",
};

const iconMap: Record<string, React.ReactNode> = {
  Layers: "⚙️",
  Brain: "🧠",
  Zap: "⚡",
  Plug: "🔌",
  BookOpen: "📖",
  Container: "📦",
  Shield: "🛡️",
  Rocket: "🚀",
};

export default function KnowledgeBasePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const categoryOptions = [
    { id: "architecture", label: "Architecture", color: "amber" },
    { id: "guides", label: "Guides", color: "amber" },
    { id: "api", label: "API Reference", color: "violet" },
    { id: "deployment", label: "Deployment", color: "teal" },
    { id: "security", label: "Security", color: "rose" },
  ];

  const filteredArticles = useMemo(() => {
    return kbArticles.filter((article) => {
      const matchesSearch =
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategories.length === 0 ||
        selectedCategories.includes(article.category);

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategories]);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Calculate article count per category
  const getArticleCountByCategory = (categoryId: string): number => {
    return kbArticles.filter((a) => a.category === categoryId).length;
  };

  return (
    <div className="min-h-screen bg-[var(--void)]">
      {/* Hero Section */}
      <section className="border-b border-[var(--border)] py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-bold text-[var(--text-primary)] mb-4 font-display">
              Knowledge Base
            </h1>
            <p className="text-lg text-[var(--text-secondary)]">
              Everything you need to build with Engram. Explore architecture,
              APIs, deployment guides, and security best practices.
            </p>
          </div>

          {/* Search Bar - Enhanced */}
          <div className="relative mb-8 group">
            <Search
              size={20}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition-colors group-focus-within:text-[var(--engram-amber)]"
            />
            <input
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-[var(--surface-1)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-all duration-300 focus:outline-none focus:border-[var(--engram-amber)] focus:ring-2 focus:ring-[var(--engram-amber)] focus:ring-opacity-20 hover:border-[var(--border)] text-base sm:text-lg"
            />
            {/* Subtle glow effect on focus */}
            <div className="absolute -inset-1 bg-gradient-to-r from-[var(--engram-amber)] to-transparent rounded-lg opacity-0 group-focus-within:opacity-10 blur transition-opacity duration-300 -z-10" />
          </div>

          {/* Category Filters - Enhanced with counts */}
          <div className="flex flex-wrap gap-3">
            {categoryOptions.map((category) => {
              const articleCount = getArticleCountByCategory(category.id);
              return (
                <button
                  key={category.id}
                  onClick={() => toggleCategory(category.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 inline-flex items-center gap-2 ${
                    selectedCategories.includes(category.id)
                      ? "bg-[var(--engram-amber)] text-[var(--void)] shadow-lg shadow-[var(--engram-amber)]/30"
                      : "bg-[var(--surface-1)] text-[var(--text-primary)] hover:bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--engram-amber)]"
                  }`}
                >
                  <span>{category.label}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      selectedCategories.includes(category.id)
                        ? "bg-[var(--void)] text-[var(--engram-amber)]"
                        : "bg-[var(--surface-2)] text-[var(--text-muted)]"
                    }`}
                  >
                    {articleCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Articles Grid */}
      <section className="py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {filteredArticles.length === 0 ? (
            <div className="text-center py-16">
              <div className="mb-6 flex justify-center">
                <div className="p-4 rounded-lg bg-[var(--surface-1)] border border-[var(--border)]">
                  <BookOpen
                    size={48}
                    className="text-[var(--text-muted)]"
                  />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                No articles found
              </h3>
              <p className="text-[var(--text-secondary)] mb-6">
                Try adjusting your search or filters to find what you need.
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategories([]);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--engram-amber)] text-[var(--void)] font-medium hover:shadow-lg hover:shadow-[var(--engram-amber)]/30 transition-all duration-300"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-max">
              {filteredArticles.map((article) => {
                const colorVar = colorMap[article.color];
                return (
                  <Link
                    key={article.slug}
                    href={`/knowledge-base/${article.slug}`}
                    className="group relative p-6 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] transition-all duration-300 hover:border-[var(--engram-amber)] hover:shadow-lg hover:shadow-[var(--engram-amber)]/20 hover:-translate-y-1"
                  >
                    {/* Left border accent - thicker and more prominent */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg transition-all duration-300 group-hover:w-1.5"
                      style={{
                        backgroundColor: `var(${colorVar})`,
                      }}
                    />

                    <div className="flex gap-4">
                      <div
                        className="text-4xl flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110"
                        style={{
                          backgroundColor: `var(${colorVar})`,
                          opacity: 0.15,
                        }}
                      >
                        {iconMap[article.icon] || "📄"}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-[var(--text-primary)] group-hover:text-[var(--engram-amber)] transition-colors duration-300">
                            {article.title}
                          </h3>
                        </div>

                        <p className="text-sm text-[var(--text-secondary)] mb-4 line-clamp-2 group-hover:text-[var(--text-primary)] transition-colors duration-300">
                          {article.description}
                        </p>

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                            <span
                              className="px-2 py-1 rounded-full font-medium transition-colors duration-300"
                              style={{
                                backgroundColor: `var(${colorVar})`,
                                color: "var(--void)",
                                opacity: 0.9,
                              }}
                            >
                              {article.category}
                            </span>
                            <span className="text-[var(--text-muted)]">
                              {article.readTime}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Results count */}
          {filteredArticles.length > 0 && (
            <p className="text-center text-sm text-[var(--text-muted)] mt-8">
              Showing{" "}
              <span className="font-semibold text-[var(--text-primary)]">
                {filteredArticles.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-[var(--text-primary)]">
                {kbArticles.length}
              </span>{" "}
              articles
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
