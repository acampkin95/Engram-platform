'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Card, Input, SectionHeader } from '@/src/design-system/components';
import { addToast } from '@/src/design-system/components/Toast';
import { crawlerClient } from '@/src/lib/crawler-client';

// ─── Schema ───────────────────────────────────────────────────────────────────

const crawlSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  maxDepth: z.coerce.number().min(1).max(5),
  maxPages: z.coerce.number().min(1).max(100),
  includePatterns: z.string().optional(),
  excludePatterns: z.string().optional(),
});

type CrawlFormData = z.infer<typeof crawlSchema>;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CrawlContent() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CrawlFormData>({
    resolver: zodResolver(crawlSchema),
    defaultValues: { maxDepth: 2, maxPages: 10 },
  });

  const onSubmit = async (data: CrawlFormData) => {
    try {
      const result = await crawlerClient.startCrawl({
        url: data.url,
        exclude_external_links: false,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      addToast({ type: 'success', message: 'Crawl job started successfully' });
      reset();
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to start crawl',
      });
    }
  };

  return (
    <div className="space-y-6 animate-page-enter">
      {/* ── Header ── */}
      <SectionHeader title="New Crawl" breadcrumb={['CRAWLER', 'CRAWL']} />

      {/* ── Form card ── */}
      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* URL */}
          <Input
            label="Target URL"
            type="url"
            placeholder="https://example.com"
            tooltip="The main URL to start crawling from"
            helpText="Must be a valid, accessible web address starting with http:// or https://"
            error={errors.url?.message}
            required
            {...register('url')}
          />

          {/* Depth + Pages row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Max Depth"
              type="number"
              tooltip="How many links deep to crawl from the starting page"
              helpText="E.g., 1 = only start page, 2 = start page + pages linked from it"
              error={errors.maxDepth?.message}
              {...register('maxDepth')}
            />
            <Input
              label="Max Pages"
              type="number"
              tooltip="The maximum total number of pages to process"
              helpText="Limits the crawl to prevent excessive resource usage"
              error={errors.maxPages?.message}
              {...register('maxPages')}
            />
          </div>

          {/* Patterns */}
          <Input
            label="Include Patterns"
            placeholder="e.g. /blog/*, /docs/*"
            tooltip="Only URLs matching these patterns will be crawled"
            helpText="Comma-separated. If left empty, all discovered URLs within the domain will be crawled."
            {...register('includePatterns')}
          />
          <Input
            label="Exclude Patterns"
            placeholder="e.g. /login, /admin/*, *.pdf"
            tooltip="URLs matching these patterns will be skipped"
            helpText="Comma-separated. Useful for skipping redundant or sensitive sections."
            {...register('excludePatterns')}
          />

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" loading={isSubmitting}>
              Start Crawl
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => reset()}
              disabled={isSubmitting}
            >
              Reset
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
