import { useCallback } from 'react';
import { create } from 'zustand';
import axios from 'axios';

export type ExtractionStrategy = 'llm' | 'css' | 'regex' | 'cosine';
export type CacheMode = 'enabled' | 'bypass' | 'write_only';
export type ViewportPreset = 'desktop' | 'tablet' | 'mobile' | 'custom';
export type UserAgentPreset = 'chrome_desktop' | 'firefox_desktop' | 'safari_mac' | 'chrome_mobile' | 'custom';

export interface BrowserConfig {
  headless: boolean;
  viewportPreset: ViewportPreset;
  viewportWidth: number;
  viewportHeight: number;
  proxyUrl: string;
  userAgentPreset: UserAgentPreset;
  customUserAgent: string;
  textMode: boolean;
  lightMode: boolean;
}

export interface WaitConditions {
  waitForSelector: string;
  waitForJs: string;
  pageTimeout: number;
  customJs: string;
  waitAfterJs: number;
}

export interface CrawlOptions {
  screenshot: boolean;
  pdf: boolean;
  cacheMode: CacheMode;
  wordCountThreshold: number;
  excludedTags: string[];
  excludeExternalLinks: boolean;
  excludeImages: boolean;
}

export interface CrawlConfig {
  isBatchMode: boolean;
  singleUrl: string;
  batchUrls: string;
  extractionStrategy: ExtractionStrategy;
  browser: BrowserConfig;
  waitConditions: WaitConditions;
  options: CrawlOptions;
}

export interface CrawlConfigErrors {
  singleUrl?: string;
  batchUrls?: string;
  proxyUrl?: string;
  [key: string]: string | undefined;
}

const DEFAULT_CONFIG: CrawlConfig = {
  isBatchMode: false,
  singleUrl: '',
  batchUrls: '',
  extractionStrategy: 'llm',
  browser: {
    headless: true,
    viewportPreset: 'desktop',
    viewportWidth: 1920,
    viewportHeight: 1080,
    proxyUrl: '',
    userAgentPreset: 'chrome_desktop',
    customUserAgent: '',
    textMode: false,
    lightMode: false,
  },
  waitConditions: {
    waitForSelector: '',
    waitForJs: '',
    pageTimeout: 30,
    customJs: '',
    waitAfterJs: 0,
  },
  options: {
    screenshot: false,
    pdf: false,
    cacheMode: 'enabled',
    wordCountThreshold: 10,
    excludedTags: [],
    excludeExternalLinks: false,
    excludeImages: false,
  },
};

interface CrawlConfigStore {
  crawlConfig: CrawlConfig;
  errors: CrawlConfigErrors;
  isSubmitting: boolean;
  lastSubmitResult: { success: boolean; crawlId?: string; message?: string } | null;

  updateConfig: <
    K1 extends keyof CrawlConfig,
    K2 extends keyof CrawlConfig[K1]
  >(
    section: K1,
    field: K2,
    value: CrawlConfig[K1][K2]
  ) => void;

  updateTopLevel: <K extends keyof CrawlConfig>(key: K, value: CrawlConfig[K]) => void;

  resetConfig: () => void;
  setErrors: (errors: CrawlConfigErrors) => void;
  setIsSubmitting: (v: boolean) => void;
  setLastSubmitResult: (r: CrawlConfigStore['lastSubmitResult']) => void;
}

const useCrawlConfigStore = create<CrawlConfigStore>((set) => ({
  crawlConfig: DEFAULT_CONFIG,
  errors: {},
  isSubmitting: false,
  lastSubmitResult: null,

  updateConfig: (section, field, value) =>
    set((state) => ({
      crawlConfig: {
        ...state.crawlConfig,
        [section]: {
          ...(state.crawlConfig[section] as object),
          [field]: value,
        },
      },
      errors: { ...state.errors },
    })),

  updateTopLevel: (key, value) =>
    set((state) => ({
      crawlConfig: { ...state.crawlConfig, [key]: value },
    })),

  resetConfig: () =>
    set({ crawlConfig: DEFAULT_CONFIG, errors: {}, lastSubmitResult: null }),

  setErrors: (errors) => set({ errors }),
  setIsSubmitting: (isSubmitting) => set({ isSubmitting }),
  setLastSubmitResult: (lastSubmitResult) => set({ lastSubmitResult }),
}));

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function parseBatchUrls(raw: string): string[] {
  return raw
    .split('\n')
    .map((u) => u.trim())
    .filter(Boolean);
}

export function useCrawlConfig() {
  const store = useCrawlConfigStore();
  const { crawlConfig, errors, isSubmitting, lastSubmitResult } = store;

  const validate = useCallback((): CrawlConfigErrors => {
    const errs: CrawlConfigErrors = {};

    if (!crawlConfig.isBatchMode) {
      if (!crawlConfig.singleUrl.trim()) {
        errs.singleUrl = 'URL is required.';
      } else if (!isValidUrl(crawlConfig.singleUrl)) {
        errs.singleUrl = 'URL must start with http:// or https://';
      }
    } else {
      const urls = parseBatchUrls(crawlConfig.batchUrls);
      if (urls.length === 0) {
        errs.batchUrls = 'At least one URL is required.';
      } else {
        const invalid = urls.filter((u) => !isValidUrl(u));
        if (invalid.length > 0) {
          errs.batchUrls = `Invalid URLs: ${invalid.slice(0, 3).join(', ')}${invalid.length > 3 ? '…' : ''}`;
        }
      }
    }

    if (crawlConfig.browser.proxyUrl && !isValidUrl(crawlConfig.browser.proxyUrl)) {
      errs.proxyUrl = 'Proxy URL must start with http:// or https://';
    }

    store.setErrors(errs);
    return errs;
  }, [crawlConfig, store]);

  const submitCrawl = useCallback(async (): Promise<boolean> => {
    const errs = validate();
    if (Object.keys(errs).length > 0) return false;

    store.setIsSubmitting(true);

    try {
      const { browser, waitConditions, options } = crawlConfig;

      const commonPayload = {
        extraction_type: crawlConfig.extractionStrategy,
        headless: browser.headless,
        viewport_width: browser.viewportWidth,
        viewport_height: browser.viewportHeight,
        proxy_url: browser.proxyUrl || undefined,
        user_agent:
          browser.userAgentPreset === 'custom' ? browser.customUserAgent || undefined : undefined,
        text_mode: browser.textMode,
        light_mode: browser.lightMode,
        wait_for: waitConditions.waitForSelector || undefined,
        wait_for_js: waitConditions.waitForJs || undefined,
        page_timeout: waitConditions.pageTimeout * 1000,
        js_code: waitConditions.customJs || undefined,
        wait_after_js: waitConditions.waitAfterJs || undefined,
        screenshot: options.screenshot,
        pdf: options.pdf,
        cache_mode: options.cacheMode,
        word_count_threshold: options.wordCountThreshold,
        excluded_tags: options.excludedTags.length > 0 ? options.excludedTags : undefined,
        exclude_external_links: options.excludeExternalLinks,
        exclude_all_images: options.excludeImages,
      };

      if (crawlConfig.isBatchMode) {
        const urls = parseBatchUrls(crawlConfig.batchUrls);
        const { data } = await axios.post('/api/crawl/batch', {
          urls,
          ...commonPayload,
        });
        store.setLastSubmitResult({ success: true, message: `Batch of ${urls.length} URLs started.`, crawlId: data.batch_id });
      } else {
        const { data } = await axios.post('/api/crawl/start', {
          url: crawlConfig.singleUrl.trim(),
          ...commonPayload,
        });
        store.setLastSubmitResult({ success: true, crawlId: data.crawl_id });
      }

      return true;
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.detail
          ? String(err.response.data.detail)
          : 'Failed to start crawl. Please try again.';
      store.setLastSubmitResult({ success: false, message });
      return false;
    } finally {
      store.setIsSubmitting(false);
    }
  }, [crawlConfig, validate, store]);

  return {
    crawlConfig,
    errors,
    isSubmitting,
    lastSubmitResult,
    updateConfig: store.updateConfig,
    updateTopLevel: store.updateTopLevel,
    resetConfig: store.resetConfig,
    validate,
    submitCrawl,
    parseBatchUrls,
  };
}
