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
      {/* Article Header */}
      <header className="border-b border-[var(--border)] py-8 mb-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-start gap-4 mb-4">
            <div
              className="text-4xl flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-lg"
              style={{
                backgroundColor: `var(${colorVar})`,
                opacity: 0.15,
              }}
            >
              {getIcon(article.icon)}
            </div>

            <div className="flex-1">
              <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-2 font-display">
                {article.title}
              </h1>

              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="px-3 py-1 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: `var(${colorVar})`,
                    color: "var(--void)",
                  }}
                >
                  {article.category.charAt(0).toUpperCase() +
                    article.category.slice(1)}
                </span>

                <span className="text-sm text-[var(--text-muted)]">
                  {article.readTime}
                </span>

                <span className="text-sm text-[var(--text-muted)]">
                  Last updated: {article.lastUpdated}
                </span>
              </div>
            </div>
          </div>

          <p className="text-lg text-[var(--text-secondary)]">
            {article.description}
          </p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <main className="lg:col-span-3">
            <article className="prose-invert max-w-none">
              {article.sections.map((section, idx) => (
                <section key={section.id} id={section.id} className="mb-12">
                  <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4 font-display scroll-mt-8">
                    {idx + 1}. {section.title}
                  </h2>

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
                                    <p key={partIdx} className="text-base">
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
                        <p key={pIdx} className="text-base">
                          {paragraph}
                        </p>
                      );
                    })}
                  </div>
                </section>
              ))}
            </article>

            {/* Navigation */}
            <nav className="border-t border-[var(--border)] pt-8 mt-12 grid grid-cols-2 gap-4">
              {prevArticle ? (
                <Link
                  href={`/knowledge-base/${prevArticle.slug}`}
                  className="flex items-center gap-2 p-4 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] hover:border-[var(--engram-amber)] transition-all group"
                >
                  <ChevronLeft
                    size={20}
                    className="text-[var(--text-muted)] group-hover:text-[var(--engram-amber)]"
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                      Previous
                    </p>
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {prevArticle.title}
                    </p>
                  </div>
                </Link>
              ) : (
                <div />
              )}

              {nextArticle ? (
                <Link
                  href={`/knowledge-base/${nextArticle.slug}`}
                  className="flex items-center justify-end gap-2 p-4 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] hover:border-[var(--engram-amber)] transition-all group"
                >
                  <div className="min-w-0 text-right">
                    <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                      Next
                    </p>
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {nextArticle.title}
                    </p>
                  </div>
                  <ChevronRight
                    size={20}
                    className="text-[var(--text-muted)] group-hover:text-[var(--engram-amber)]"
                  />
                </Link>
              ) : (
                <div />
              )}
            </nav>

            {/* Back Link */}
            <div className="mt-8">
              <Link
                href="/knowledge-base"
                className="inline-flex items-center gap-2 text-[var(--engram-amber)] hover:text-[var(--engram-amber-bright)] transition-colors"
              >
                <ChevronLeft size={18} />
                Back to Knowledge Base
              </Link>
            </div>
          </main>

          {/* Table of Contents Sidebar */}
          <aside className="hidden lg:block">
            <TableOfContents sections={article.sections} />
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
