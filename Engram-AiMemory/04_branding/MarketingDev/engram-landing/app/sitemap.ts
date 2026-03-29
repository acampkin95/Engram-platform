import type { MetadataRoute } from 'next';
import { kbArticles } from './lib/kb-data';
import { products } from './lib/platform-data';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://memory.velocitydigi.com/engram';

  return [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/platform`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/knowledge-base`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/getting-started`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    ...products.map((p) => ({
      url: `${base}/platform/${p.slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    ...kbArticles.map((a) => ({
      url: `${base}/knowledge-base/${a.slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
