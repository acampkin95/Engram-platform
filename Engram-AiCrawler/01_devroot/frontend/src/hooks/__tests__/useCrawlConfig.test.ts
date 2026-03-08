import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCrawlConfig, parseBatchUrls } from '../useCrawlConfig';

const { mockAxiosPost, mockIsAxiosError } = vi.hoisted(() => ({
  mockAxiosPost: vi.fn(),
  mockIsAxiosError: vi.fn(() => false),
}));

vi.mock('axios', () => ({
  default: {
    post: mockAxiosPost,
    isAxiosError: mockIsAxiosError,
  },
}));

function setup() {
  const utils = renderHook(() => useCrawlConfig());
  act(() => utils.result.current.resetConfig());
  return utils;
}

describe('useCrawlConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns default config with empty URLs and llm extraction strategy', () => {
    const { result } = setup();
    expect(result.current.crawlConfig.singleUrl).toBe('');
    expect(result.current.crawlConfig.batchUrls).toBe('');
    expect(result.current.crawlConfig.extractionStrategy).toBe('llm');
    expect(result.current.crawlConfig.isBatchMode).toBe(false);
  });

  it('default browser config has headless=true and desktop viewport', () => {
    const { result } = setup();
    const browser = result.current.crawlConfig.browser;
    expect(browser.headless).toBe(true);
    expect(browser.viewportWidth).toBe(1920);
    expect(browser.viewportHeight).toBe(1080);
    expect(browser.viewportPreset).toBe('desktop');
  });

  it('updateConfig updates a nested field', () => {
    const { result } = setup();

    act(() => {
      result.current.updateConfig('browser', 'headless', false);
    });

    expect(result.current.crawlConfig.browser.headless).toBe(false);
  });

  it('updateTopLevel updates a top-level field', () => {
    const { result } = setup();

    act(() => {
      result.current.updateTopLevel('singleUrl', 'https://example.com');
    });

    expect(result.current.crawlConfig.singleUrl).toBe('https://example.com');
  });

  it('resetConfig restores all fields to defaults', () => {
    const { result } = setup();

    act(() => {
      result.current.updateTopLevel('singleUrl', 'https://changed.com');
      result.current.updateConfig('browser', 'headless', false);
    });

    act(() => {
      result.current.resetConfig();
    });

    expect(result.current.crawlConfig.singleUrl).toBe('');
    expect(result.current.crawlConfig.browser.headless).toBe(true);
  });

  it('validate() returns error for empty singleUrl in single mode', () => {
    const { result } = setup();

    let errors = {};
    act(() => {
      errors = result.current.validate();
    });

    expect(errors).toHaveProperty('singleUrl');
  });

  it('validate() returns error for invalid URL format', () => {
    const { result } = setup();

    act(() => {
      result.current.updateTopLevel('singleUrl', 'not-a-url');
    });

    let errors = {};
    act(() => {
      errors = result.current.validate();
    });

    expect(errors).toHaveProperty('singleUrl');
  });

  it('validate() passes for a valid http URL', () => {
    const { result } = setup();

    act(() => {
      result.current.updateTopLevel('singleUrl', 'https://example.com');
    });

    let errors = {};
    act(() => {
      errors = result.current.validate();
    });

    expect(errors).not.toHaveProperty('singleUrl');
  });

  it('validate() returns error when batch mode has no URLs', () => {
    const { result } = setup();

    act(() => {
      result.current.updateTopLevel('isBatchMode', true);
      result.current.updateTopLevel('batchUrls', '');
    });

    let errors = {};
    act(() => {
      errors = result.current.validate();
    });

    expect(errors).toHaveProperty('batchUrls');
  });

  it('submitCrawl returns false without calling axios when validation fails', async () => {
    const { result } = setup();

    let success = true;
    await act(async () => {
      success = await result.current.submitCrawl();
    });

    expect(success).toBe(false);
    expect(mockAxiosPost).not.toHaveBeenCalled();
  });

  it('submitCrawl calls axios.post and returns true on success', async () => {
    const { result } = setup();
    mockAxiosPost.mockResolvedValue({ data: { crawl_id: 'abc123' } });

    act(() => {
      result.current.updateTopLevel('singleUrl', 'https://example.com');
    });

    let success = false;
    await act(async () => {
      success = await result.current.submitCrawl();
    });

    expect(success).toBe(true);
    expect(mockAxiosPost).toHaveBeenCalledWith(
      '/api/crawl/start',
      expect.objectContaining({ url: 'https://example.com' })
    );
    expect(result.current.lastSubmitResult?.success).toBe(true);
    expect(result.current.lastSubmitResult?.crawlId).toBe('abc123');
  });

  it('submitCrawl sets error result and returns false on axios error', async () => {
    const { result } = setup();
    const axiosErr = new Error('Server error') as Error & { isAxiosError: boolean; response?: unknown };
    axiosErr.isAxiosError = true;
    mockAxiosPost.mockRejectedValue(axiosErr);
    mockIsAxiosError.mockReturnValue(true);

    act(() => {
      result.current.updateTopLevel('singleUrl', 'https://example.com');
    });

    let success = true;
    await act(async () => {
      success = await result.current.submitCrawl();
    });

    expect(success).toBe(false);
    expect(result.current.lastSubmitResult?.success).toBe(false);
    expect(result.current.isSubmitting).toBe(false);
  });
});

describe('parseBatchUrls', () => {
  it('splits by newline and trims whitespace', () => {
    expect(parseBatchUrls('https://a.com\nhttps://b.com')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('filters out blank lines', () => {
    expect(parseBatchUrls('https://a.com\n\nhttps://b.com\n')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('returns empty array for empty string', () => {
    expect(parseBatchUrls('')).toEqual([]);
  });
});
