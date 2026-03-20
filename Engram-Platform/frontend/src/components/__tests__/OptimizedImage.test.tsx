import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { imageSizes, LazyLoad, OptimizedImage } from '../OptimizedImage';

vi.mock('next/image', () => ({
  default: ({
    alt,
    fill: _fill,
    priority: _priority,
    quality: _quality,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
    quality?: number;
  }) => (
    // biome-ignore lint/performance/noImgElement: mock component
    <img alt={alt} {...props} />
  ),
}));

const observerInstances: MockIntersectionObserver[] = [];

class MockIntersectionObserver {
  private callback: (entries: Array<{ isIntersecting: boolean }>) => void;

  observe = vi.fn();
  disconnect = vi.fn();

  constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
    this.callback = callback;
    observerInstances.push(this);
  }

  trigger(isIntersecting: boolean) {
    this.callback([{ isIntersecting }]);
  }
}

describe('OptimizedImage', () => {
  beforeEach(() => {
    observerInstances.length = 0;
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver as never);

    if (!globalThis.btoa) {
      vi.stubGlobal('btoa', (value: string) => Buffer.from(value).toString('base64'));
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders immediately when priority is true and fires onLoad', async () => {
    const onLoad = vi.fn();

    render(
      <OptimizedImage
        src="/test.png"
        alt="priority"
        width={320}
        height={180}
        priority
        onLoad={onLoad}
      />,
    );

    const img = screen.getByAltText('priority');
    fireEvent.load(img);

    await waitFor(() => {
      expect(onLoad).toHaveBeenCalledOnce();
      expect(img.className).toContain('opacity-100');
    });
  });

  it('lazy-loads image after intersection observer reports in-view', async () => {
    render(<OptimizedImage src="/lazy.png" alt="lazy" width={200} height={120} />);

    expect(screen.queryByAltText('lazy')).not.toBeInTheDocument();
    expect(observerInstances).toHaveLength(1);

    act(() => {
      observerInstances[0].trigger(true);
    });

    expect(screen.getByAltText('lazy')).toBeInTheDocument();
  });

  it('shows fallback message when image errors', async () => {
    render(<OptimizedImage src="/broken.png" alt="broken" width={100} height={100} priority />);

    fireEvent.error(screen.getByAltText('broken'));

    await waitFor(() => {
      expect(screen.getByText('Failed to load image')).toBeInTheDocument();
    });
  });

  it('supports empty placeholder mode without blur layer', () => {
    const { container } = render(
      <OptimizedImage
        src="/no-blur.png"
        alt="no-blur"
        width={100}
        height={100}
        priority
        placeholder="empty"
      />,
    );

    expect(container.querySelector('.blur-lg')).not.toBeInTheDocument();
  });
});

describe('LazyLoad + imageSizes', () => {
  beforeEach(() => {
    observerInstances.length = 0;
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders placeholder before entering viewport and then children', () => {
    render(
      <LazyLoad placeholder={<div>Waiting...</div>}>
        <div>Loaded content</div>
      </LazyLoad>,
    );

    expect(screen.getByText('Waiting...')).toBeInTheDocument();

    act(() => {
      observerInstances[0].trigger(true);
    });

    expect(screen.getByText('Loaded content')).toBeInTheDocument();
  });

  it('exports responsive image size presets', () => {
    expect(imageSizes.fullWidth).toBe('100vw');
    expect(imageSizes.fixedSmall).toBe('64px');
    expect(imageSizes.hero).toBe('100vw');
  });
});
