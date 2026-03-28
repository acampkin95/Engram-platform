import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Copy, Check } from "lucide-react";
import { kbArticles, KBArticle } from "@/app/lib/kb-data";
import CodeBlock from "@/app/components/CodeBlock";
import TableOfContents from "@/app/components/TableOfContents";

export async function generateStaticParams() {
  return kbArticles.map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const article = kbArticles.find((a) => a.slug === params.slug);
  if (!article) return {};

  return {
    title: `${article.title} | Engram Knowledge Base`,
    description: article.description,
  };
}

const colorMap = {
  amber: "--engram-amber",
  violet: "--engram-violet",
  teal: "--engram-teal",
  rose: "--engram-rose",
};

export default function ArticlePage({
  params,
}: {
  params: { slug: string };
}) {
  const article = kbArticles.find((a) => a.slug === params.slug);
  if (!article) notFound();

  const currentIndex = kbArticles.findIndex((a) => a.slug === params.slug);
  const prevArticle = currentIndex > 0 ? kbArticles[currentIndex - 1] : null;
  const nextArticle =
    currentIndex < kbArticles.length - 1 ? kbArticles[currentIndex + 1] : null;

  const colorVar = colorMap[article.color];

  return (
    <div className="min-h-screen bg-[var(--void)]">
      {/* Back to Knowledge Base Link - Top */}
      <div className="border-b border-[var(--border)] py-4">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/knowledge-base"
            className="inline-flex items-center gap-2 text-[var(--engram-amber)] hover:text-[var(--engram-amber)] transition-all duration-300 group font-medium text-sm"
          >
            <ChevronLeft
              size={18}
              className="transition-transform duration-300 group-hover:-translate-x-0.5"
            />
            <span className="underline decoration-[var(--engram-amber)] decoration-1 underline-offset-2 group-hover:decoration-2">
              Back to Knowledge Base
            </span>
          </Link>
        </div>
      </div>

      {/* Article Header */}
      <header className="border-b border-[var(--border)] py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-start gap-4 mb-6">
            <div
              className="text-4xl flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-lg transition-transform duration-300 hover:scale-110"
              style={{
                backgroundColor: `var(${colorVar})`,
                opacity: 0.15,
              }}
            >
              {getIcon(article.icon)}
            </div>

            <div className="flex-1">
              <h1 className="text-4xl sm:text-5xl font-bold text-[var(--text-primary)] mb-4 font-display">
                {article.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4">
                <span
                  className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-current/20"
                  style={{
                    backgroundColor: `var(${colorVar})`,
                    color: "var(--void)",
                  }}
                >
                  {article.category.charAt(0).toUpperCase() +
                    article.category.slice(1)}
                </span>

                <span className="text-sm text-[var(--text-muted)] font-mono">
                  {article.readTime}
                </span>

                <span className="text-sm text-[var(--text-muted)] font-mono">
                  Updated: {article.lastUpdated}
                </span>
              </div>
            </div>
          </div>

          <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
            {article.description}
          </p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <main className="lg:col-span-3">
            <article className="prose-invert max-w-none">
              {article.sections.map((section, idx) => (
                <section key={section.id} id={section.id} className="mb-12 scroll-mt-20">
                  {/* Section heading with anchor link icon */}
                  <div className="flex items-center gap-3 mb-4 group">
                    <h2 className="text-2xl font-bold text-[var(--text-primary)] font-display flex-1">
                      <span className="inline-block">
                        {idx + 1}. {section.title}
                      </span>
                    </h2>
                    <a
                      href={`#${section.id}`}
                      className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--engram-amber)] transition-all duration-300 p-2"
                      aria-label={`Link to section: ${section.title}`}
                    >
                      <span className="text-lg font-light">#</span>
                    </a>
                  </div>

                  <div className="space-y-4 text-[var(--text-secondary)] leading-relaxed">
                    {section.content.split("\n\n").map((paragraph, pIdx) => {
                      // Check if paragraph contains code block
                      if (paragraph.includes("```")) {
                        const parts = paragraph.split(
                          /```(?:[\w-]+)?\n([\s\S]*?)\n```/
                        );

                        return (
                          <div key={pIdx} className="space-y-4">
                            {parts.map((part, partIdx) => {
                              if (partIdx % 2 === 0) {
                                // Text part
                                if (part.trim()) {
                                  return (
                                    <p
                                      key={partIdx}
                                      className="text-base text-[var(--text-secondary)]"
                                    >
                                      {part}
                                    </p>
                                  );
                                }
                              } else {
                                // Code part
                                return (
                                  <CodeBlock key={partIdx} code={part} />
                                );
                              }
                              return null;
                            })}
                          </div>
                        );
                      }

                      // Regular paragraph
                      return (
                        <p
                          key={pIdx}
                          className="text-base text-[var(--text-secondary)] leading-7"
                        >
                          {paragraph}
                        </p>
                      );
                    })}
                  </div>
                </section>
              ))}
            </article>

            {/* Navigation - Enhanced card style */}
            <nav className="border-t border-[var(--border)] pt-8 mt-12">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {prevArticle ? (
                  <Link
                    href={`/knowledge-base/${prevArticle.slug}`}
                    className="flex flex-col gap-2 p-6 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] hover:border-[var(--engram-amber)] transition-all duration-300 group hover:shadow-lg hover:shadow-[var(--engram-amber)]/10 hover:-translate-y-1"
                  >
                    <div className="flex items-center gap-2 text-[var(--text-muted)] group-hover:text-[var(--engram-amber)] transition-colors duration-300">
                      <ChevronLeft size={18} />
                      <span className="text-xs font-mono uppercase tracking-wider">
                        Previous
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--engram-amber)] transition-colors duration-300 line-clamp-2">
                      {prevArticle.title}
                    </p>
                  </Link>
                ) : (
                  <div />
                )}

                {nextArticle ? (
                  <Link
                    href={`/knowledge-base/${nextArticle.slug}`}
                    className="flex flex-col gap-2 p-6 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] hover:border-[var(--engram-amber)] transition-all duration-300 group hover:shadow-lg hover:shadow-[var(--engram-amber)]/10 hover:-translate-y-1 text-right"
                  >
                    <div className="flex items-center justify-end gap-2 text-[var(--text-muted)] group-hover:text-[var(--engram-amber)] transition-colors duration-300">
                      <span className="text-xs font-mono uppercase tracking-wider">
                        Next
                      </span>
                      <ChevronRight size={18} />
                    </div>
                    <p className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--engram-amber)] transition-colors duration-300 line-clamp-2">
                      {nextArticle.title}
                    </p>
                  </Link>
                ) : (
                  <div />
                )}
              </div>
            </nav>
          </main>

          {/* Table of Contents Sidebar - Sticky on desktop */}
          <aside className="hidden lg:block">
            <div className="sticky top-8">
              <TableOfContents sections={article.sections} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function getIcon(iconName: string): string {
  const iconMap: Record<string, string> = {
    Layers: "⚙️",
    Brain: "🧠",
    Zap: "⚡",
    Plug: "🔌",
    BookOpen: "📖",
    Container: "📦",
    Shield: "🛡️",
    Rocket: "🚀",
  };
  return iconMap[iconName] || "📄";
}
