import { products, getProductBySlug, getColorVar } from '@/app/lib/platform-data';
import Link from 'next/link';
import { Button } from '@/app/components/ui/Button';
import * as Icons from 'lucide-react';

const iconMap: Record<string, React.ComponentType<any>> = {
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
    <div className="space-y-24">
      {/* Header */}
      <section className="space-y-8 py-8">
        <div className="flex items-start gap-8">
          {Icon && (
            <div
              className="w-20 h-20 rounded-xl flex items-center justify-center bg-[var(--surface-2)]/60 backdrop-blur-md border border-[var(--border)] flex-shrink-0 shadow-md"
              style={{
                borderLeft: `3px solid ${colorVar}`,
              }}
            >
              <Icon size={48} className="flex-shrink-0" style={{ color: colorVar }} />
            </div>
          )}

          <div className="flex-1">
            <div className="mb-4 inline-block">
              <span
                className="font-[var(--font-mono)] text-xs tracking-widest uppercase"
                style={{ color: colorVar }}
              >
                Service
              </span>
            </div>

            <h1
              className="font-[var(--font-display)] font-black text-6xl mb-4"
              style={{
                background: `linear-gradient(135deg, var(--text-primary), ${colorVar})`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
              }}
            >
              {product.name}
            </h1>

            <p
              className="font-[var(--font-body)] italic text-lg mb-6"
              style={{ color: colorVar }}
            >
              {product.tagline}
            </p>

            <div className="flex items-center gap-4 flex-wrap">
              <span
                className="px-4 py-2 rounded-full text-xs font-[var(--font-mono)] font-semibold bg-[var(--layer-1)]/60 border-2 backdrop-blur-sm"
                style={{
                  borderColor: colorVar,
                  color: colorVar,
                }}
              >
                PORT {product.port}
              </span>

              <span className="text-[var(--text-muted)] font-[var(--font-mono)] text-sm tracking-wide">
                {product.techStack.length} TECHNOLOGIES
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--border)] pt-8">
          <p className="text-lg text-[var(--text-secondary)] leading-relaxed max-w-4xl">
            {product.description}
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section>
        <h2 className="font-[var(--font-display)] font-bold text-4xl mb-10">Key Features</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {product.features.map((feature, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)]/40 backdrop-blur-md p-8 hover:bg-[var(--surface-1)]/60 hover:shadow-md transition-all duration-300 group"
              style={{
                borderLeft: `3px solid ${colorVar}`,
              }}
            >
              <h3 className="font-[var(--font-display)] font-semibold text-xl mb-3 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r transition-all duration-300"
                style={{
                  backgroundImage: `linear-gradient(135deg, var(--text-primary), ${colorVar})`,
                }}>
                {feature.title}
              </h3>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Code Example */}
      <section>
        <h2 className="font-[var(--font-display)] font-bold text-4xl mb-10">
          {product.codeExample.title}
        </h2>

        <div className="rounded-xl border border-[var(--border)] overflow-hidden shadow-lg">
          {/* Code Header */}
          <div
            className="px-8 py-5 border-b border-[var(--border)] flex items-center justify-between backdrop-blur-sm"
            style={{ background: 'var(--layer-1)/60' }}
          >
            <span
              className="font-[var(--font-mono)] text-sm font-semibold tracking-wide"
              style={{ color: colorVar }}
            >
              {product.codeExample.language}
            </span>

            <button
              onClick={() => {
                navigator.clipboard.writeText(product.codeExample.code);
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-[var(--font-mono)] hover:bg-[var(--surface-1)] transition-all duration-200 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--border)]"
            >
              <Icons.Copy size={14} />
              Copy
            </button>
          </div>

          {/* Code Block */}
          <pre
            className="p-8 overflow-x-auto text-sm leading-relaxed font-[var(--font-mono)]"
            style={{
              background: 'linear-gradient(135deg, var(--layer-2), var(--layer-1))',
              color: 'var(--text-primary)',
              borderLeft: `4px solid ${colorVar}`,
            }}
          >
            {product.codeExample.code}
          </pre>
        </div>
      </section>

      {/* API Endpoints (if applicable) */}
      {product.endpoints && product.endpoints.length > 0 && (
        <section>
          <h2 className="font-[var(--font-display)] font-bold text-4xl mb-10">API Endpoints</h2>

          <div className="overflow-x-auto rounded-xl border border-[var(--border)] shadow-lg">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b border-[var(--border)]"
                  style={{ background: 'var(--layer-1)/60' }}
                >
                  <th className="px-8 py-4 text-left font-[var(--font-mono)] font-semibold text-[var(--text-secondary)] tracking-wide">
                    METHOD
                  </th>
                  <th className="px-8 py-4 text-left font-[var(--font-mono)] font-semibold text-[var(--text-secondary)] tracking-wide">
                    PATH
                  </th>
                  <th className="px-8 py-4 text-left font-[var(--font-mono)] font-semibold text-[var(--text-secondary)] tracking-wide">
                    DESCRIPTION
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

                  const isEven = idx % 2 === 0;

                  return (
                    <tr
                      key={idx}
                      className="border-b border-[var(--border)] hover:bg-[var(--surface-1)]/30 transition-colors"
                      style={{
                        background: isEven ? 'var(--layer-1)/10' : 'transparent',
                      }}
                    >
                      <td className="px-8 py-5">
                        <span
                          className="px-3 py-1.5 rounded-md text-xs font-[var(--font-mono)] font-semibold bg-[var(--layer-1)]/80 border border-[var(--border)]/50"
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

                      <td className="px-8 py-5 font-[var(--font-mono)] text-[var(--text-primary)] text-xs tracking-tight">
                        {endpoint.path}
                      </td>

                      <td className="px-8 py-5 text-[var(--text-secondary)]">
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
        <h2 className="font-[var(--font-display)] font-bold text-4xl mb-10">Technology Stack</h2>

        <div className="flex flex-wrap gap-3">
          {product.techStack.map((tech) => (
            <span
              key={tech}
              className="px-4 py-2 rounded-full text-sm font-[var(--font-mono)] bg-[var(--layer-1)]/40 backdrop-blur-sm border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border)] hover:bg-[var(--layer-1)]/60 transition-all duration-200"
            >
              {tech}
            </span>
          ))}
        </div>
      </section>

      {/* Related Products */}
      <section>
        <h2 className="font-[var(--font-display)] font-bold text-4xl mb-10">Other Services</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {otherProducts.map((related) => {
            const RelatedIcon = iconMap[related.icon];
            const relatedColorVar = getColorVar(related.color);

            return (
              <Link key={related.slug} href={`/platform/${related.slug}`}>
                <div
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)]/40 backdrop-blur-md hover:bg-[var(--surface-1)]/60 transition-all duration-300 p-8 cursor-pointer group h-full hover:shadow-md hover:border-[var(--border)]"
                  style={{
                    borderTop: `3px solid ${relatedColorVar}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <h3 className="font-[var(--font-display)] font-semibold text-lg group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r transition-all duration-300"
                      style={{
                        backgroundImage: `linear-gradient(135deg, var(--text-primary), ${relatedColorVar})`,
                      }}>
                      {related.name}
                    </h3>

                    {RelatedIcon && (
                      <div style={{ color: relatedColorVar }} className="group-hover:scale-110 transition-transform">
                        <RelatedIcon size={24} className="flex-shrink-0" />
                      </div>
                    )}
                  </div>

                  <p
                    className="text-sm font-[var(--font-mono)] mb-6 tracking-wide"
                    style={{ color: relatedColorVar }}
                  >
                    {related.tagline}
                  </p>

                  <span
                    className="text-sm font-[var(--font-display)] font-semibold group-hover:translate-x-2 transition-transform duration-300 inline-flex items-center gap-1"
                    style={{ color: relatedColorVar }}
                  >
                    Explore
                    <Icons.ArrowRight size={16} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Getting Started CTA */}
      <section className="border-t border-[var(--border)] pt-16">
        <div
          className="rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface-2)]/50 via-[var(--surface-1)]/30 to-transparent p-16 text-center backdrop-blur-sm hover:from-[var(--surface-2)]/60 hover:via-[var(--surface-1)]/40 transition-all duration-300"
        >
          <h2 className="font-[var(--font-display)] font-bold text-4xl mb-6">Ready to Start?</h2>

          <p className="text-[var(--text-secondary)] mb-10 max-w-2xl mx-auto leading-relaxed text-lg">
            Follow our step-by-step getting started guide to set up the entire Engram platform
            and integrate {product.name} into your workflow.
          </p>

          <Link href="/getting-started">
            <Button>View Setup Guide</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
