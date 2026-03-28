import { products, getProductBySlug, getColorVar } from '@/app/lib/platform-data';
import Link from 'next/link';
import { Button } from '@/app/components/ui/Button';
import * as Icons from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ size: number; className: string }>> = {
  Brain: Icons.Brain,
  Globe: Icons.Globe,
  Server: Icons.Server,
  LayoutDashboard: Icons.LayoutDashboard,
};

export function generateStaticParams() {
  return products.map((product) => ({
    product: product.slug,
  }));
}

interface ProductPageProps {
  params: { product: string };
}

export default function ProductPage({ params }: ProductPageProps) {
  const product = getProductBySlug(params.product);

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-[var(--font-display)] font-bold text-3xl mb-4">
            Product Not Found
          </h1>
          <Link href="/platform">
            <Button>Back to Platform</Button>
          </Link>
        </div>
      </div>
    );
  }

  const Icon = iconMap[product.icon];
  const colorVar = getColorVar(product.color);
  const otherProducts = products.filter((p) => p.slug !== product.slug);

  return (
    <div className="space-y-20">
      {/* Header */}
      <section className="space-y-8">
        <div className="flex items-start gap-6">
          {Icon && (
            <div
              className="w-16 h-16 rounded-lg flex items-center justify-center bg-[var(--surface-2)]"
              style={{
                borderLeft: `2px solid ${colorVar}`,
              }}
            >
              <Icon size={40} className="text-[var(--text-primary)]" />
            </div>
          )}

          <div className="flex-1">
            <h1 className="font-[var(--font-display)] font-black text-5xl mb-2">
              {product.name}
            </h1>

            <p
              className="font-[var(--font-mono)] text-lg font-semibold mb-4"
              style={{ color: colorVar }}
            >
              {product.tagline}
            </p>

            <div className="flex items-center gap-4">
              <span
                className="px-3 py-1 rounded-full text-xs font-[var(--font-mono)] bg-[var(--layer-1)] border"
                style={{
                  borderColor: colorVar,
                  color: colorVar,
                }}
              >
                Port {product.port}
              </span>

              <span className="text-[var(--text-muted)] font-[var(--font-mono)] text-xs">
                {product.techStack.length} technologies
              </span>
            </div>
          </div>
        </div>

        <p className="text-lg text-[var(--text-secondary)] leading-relaxed max-w-4xl">
          {product.description}
        </p>
      </section>

      {/* Features Grid */}
      <section>
        <h2 className="font-[var(--font-display)] font-bold text-3xl mb-8">Key Features</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {product.features.map((feature, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-6 hover:bg-[var(--surface-2)] transition-colors"
              style={{
                borderLeft: `2px solid ${colorVar}`,
              }}
            >
              <h3 className="font-[var(--font-display)] font-semibold text-lg mb-2">
                {feature.title}
              </h3>
              <p className="text-[var(--text-secondary)]">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Code Example */}
      <section>
        <h2 className="font-[var(--font-display)] font-bold text-3xl mb-8">
          {product.codeExample.title}
        </h2>

        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          {/* Code Header */}
          <div
            className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between"
            style={{ background: 'var(--layer-1)' }}
          >
            <span
              className="font-[var(--font-mono)] text-sm font-semibold"
              style={{ color: colorVar }}
            >
              {product.codeExample.language}
            </span>

            <button
              onClick={() => {
                navigator.clipboard.writeText(product.codeExample.code);
              }}
              className="flex items-center gap-2 px-3 py-1 rounded text-xs font-[var(--font-mono)] hover:bg-[var(--surface-1)] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <Icons.Copy size={14} />
              Copy
            </button>
          </div>

          {/* Code Block */}
          <pre
            className="p-6 overflow-x-auto text-sm leading-relaxed font-[var(--font-mono)]"
            style={{
              background: 'var(--layer-2)',
              color: 'var(--text-primary)',
              borderLeft: `3px solid ${colorVar}`,
            }}
          >
            {product.codeExample.code}
          </pre>
        </div>
      </section>

      {/* API Endpoints (if applicable) */}
      {product.endpoints && product.endpoints.length > 0 && (
        <section>
          <h2 className="font-[var(--font-display)] font-bold text-3xl mb-8">API Endpoints</h2>

          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]" style={{ background: 'var(--layer-1)' }}>
                  <th className="px-6 py-4 text-left font-[var(--font-mono)] font-semibold text-[var(--text-secondary)]">
                    Method
                  </th>
                  <th className="px-6 py-4 text-left font-[var(--font-mono)] font-semibold text-[var(--text-secondary)]">
                    Path
                  </th>
                  <th className="px-6 py-4 text-left font-[var(--font-mono)] font-semibold text-[var(--text-secondary)]">
                    Description
                  </th>
                </tr>
              </thead>

              <tbody>
                {product.endpoints.map((endpoint, idx) => {
                  const methodColors = {
                    GET: 'var(--engram-teal)',
                    POST: 'var(--engram-amber)',
                    PUT: 'var(--engram-violet)',
                    DELETE: 'var(--engram-rose)',
                  };

                  return (
                    <tr
                      key={idx}
                      className="border-b border-[var(--border)] hover:bg-[var(--surface-1)] transition-colors"
                    >
                      <td className="px-6 py-4">
                        <span
                          className="px-2 py-1 rounded text-xs font-[var(--font-mono)] font-semibold bg-[var(--layer-1)]"
                          style={{
                            color:
                              methodColors[
                                endpoint.method as keyof typeof methodColors
                              ],
                          }}
                        >
                          {endpoint.method}
                        </span>
                      </td>

                      <td className="px-6 py-4 font-[var(--font-mono)] text-[var(--text-primary)]">
                        {endpoint.path}
                      </td>

                      <td className="px-6 py-4 text-[var(--text-secondary)]">
                        {endpoint.description}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tech Stack */}
      <section>
        <h2 className="font-[var(--font-display)] font-bold text-3xl mb-8">Technology Stack</h2>

        <div className="flex flex-wrap gap-3">
          {product.techStack.map((tech) => (
            <span
              key={tech}
              className="px-4 py-2 rounded-full text-sm font-[var(--font-mono)] bg-[var(--layer-1)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)] transition-colors"
            >
              {tech}
            </span>
          ))}
        </div>
      </section>

      {/* Related Products */}
      <section>
        <h2 className="font-[var(--font-display)] font-bold text-3xl mb-8">Other Services</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {otherProducts.map((related) => {
            const RelatedIcon = iconMap[related.icon];
            const relatedColorVar = getColorVar(related.color);

            return (
              <Link key={related.slug} href={`/platform/${related.slug}`}>
                <div
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] transition-all p-6 cursor-pointer group h-full"
                  style={{
                    borderTop: `2px solid ${relatedColorVar}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <h3 className="font-[var(--font-display)] font-semibold text-lg">
                      {related.name}
                    </h3>

                    {RelatedIcon && (
                      <div style={{ color: relatedColorVar }}>
                        <RelatedIcon size={24} className="flex-shrink-0" />
                      </div>
                    )}
                  </div>

                  <p
                    className="text-sm font-[var(--font-mono)] mb-4"
                    style={{ color: relatedColorVar }}
                  >
                    {related.tagline}
                  </p>

                  <span
                    className="text-sm font-[var(--font-display)] font-semibold group-hover:translate-x-1 transition-transform inline-block"
                    style={{ color: relatedColorVar }}
                  >
                    Explore →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Getting Started CTA */}
      <section className="border-t border-[var(--border)] pt-12">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-12 text-center">
          <h2 className="font-[var(--font-display)] font-bold text-3xl mb-4">Ready to Start?</h2>

          <p className="text-[var(--text-secondary)] mb-8 max-w-xl mx-auto">
            Follow our step-by-step getting started guide to set up the entire Engram platform.
          </p>

          <Link href="/getting-started">
            <Button>View Setup Guide</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
