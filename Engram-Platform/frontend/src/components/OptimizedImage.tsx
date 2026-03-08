'use client';

import NextImage from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/src/lib/utils';

// =============================================================================
// OPTIMIZED IMAGE COMPONENT
// Features:
// - Blur placeholder for perceived performance
// - Intersection Observer for lazy loading
// - Responsive srcset generation
// - WebP/AVIF format support
// =============================================================================

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  priority?: boolean;
  quality?: number;
  sizes?: string;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Generate a tiny blur data URL for placeholder
 * Uses a 1x1 pixel SVG for minimal size
 */
function generateBlurDataURL(color: string = '#090818'): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">
      <rect width="1" height="1" fill="${color}"/>
    </svg>
  `;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Optimized Image Component
 *
 * Automatically handles:
 * - Lazy loading with intersection observer
 * - Blur placeholder for smooth loading
 * - Responsive image sizing
 * - Modern format selection (AVIF/WebP)
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill,
  className,
  priority = false,
  quality = 85,
  sizes = '(max-width: 640px) 100vw, (max-width: 1080px) 50vw, 33vw',
  placeholder = 'blur',
  blurDataURL,
  onLoad,
  onError,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  // Use intersection observer for lazy loading (if not priority)
  useEffect(() => {
    if (priority || !imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        // Start loading when image is 200px away from viewport
        rootMargin: '200px',
        threshold: 0,
      },
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, [priority]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // Generate blur placeholder if not provided
  const blurPlaceholder = blurDataURL || generateBlurDataURL();

  // Error state fallback
  if (hasError) {
    return (
      <div
        ref={imgRef}
        className={cn(
          'bg-layer-1 flex items-center justify-center',
          fill && 'absolute inset-0',
          className,
        )}
        style={!fill ? { width, height } : undefined}
      >
        <span className="text-text-muted text-sm">Failed to load image</span>
      </div>
    );
  }

  // Don't render image until in view (lazy loading)
  if (!isInView) {
    return (
      <div
        ref={imgRef}
        className={cn('bg-layer-1 animate-pulse', fill && 'absolute inset-0', className)}
        style={!fill ? { width, height } : undefined}
      />
    );
  }

  return (
    <div
      ref={imgRef}
      className={cn('relative overflow-hidden', fill && 'absolute inset-0', className)}
      style={!fill ? { width, height } : undefined}
    >
      {/* Blur placeholder */}
      {!isLoaded && placeholder === 'blur' && (
        <div
          className="absolute inset-0 bg-cover bg-center blur-lg transition-opacity duration-300"
          style={{
            backgroundImage: `url(${blurPlaceholder})`,
            opacity: isLoaded ? 0 : 1,
          }}
        />
      )}

      <NextImage
        src={src}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        priority={priority}
        quality={quality}
        sizes={sizes}
        placeholder={placeholder}
        blurDataURL={blurPlaceholder}
        onLoad={handleLoad}
        onError={handleError}
        className={cn('transition-opacity duration-300', isLoaded ? 'opacity-100' : 'opacity-0')}
        style={{
          objectFit: 'cover',
        }}
      />
    </div>
  );
}

// =============================================================================
// LAZY LOADING WRAPPER COMPONENT
// For components that need to be lazy-loaded below the fold
// =============================================================================

interface LazyLoadProps {
  children: React.ReactNode;
  className?: string;
  rootMargin?: string;
  threshold?: number;
  placeholder?: React.ReactNode;
}

export function LazyLoad({
  children,
  className,
  rootMargin = '100px',
  threshold = 0.1,
  placeholder,
}: LazyLoadProps) {
  const [isInView, setIsInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin,
        threshold,
      },
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  return (
    <div ref={ref} className={className}>
      {isInView ? children : placeholder || <div className="h-48 bg-layer-1 animate-pulse" />}
    </div>
  );
}

// =============================================================================
// RESPONSIVE IMAGE SIZES HELPER
// Generates appropriate sizes attribute for common layouts
// =============================================================================

export const imageSizes = {
  // Full width images
  fullWidth: '100vw',

  // Half width (2-column layouts)
  halfWidth: '(max-width: 768px) 100vw, 50vw',

  // Third width (3-column layouts)
  thirdWidth: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',

  // Quarter width (4-column layouts)
  quarterWidth: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw',

  // Fixed small size (avatars, thumbnails)
  fixedSmall: '64px',

  // Card images
  card: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',

  // Hero images
  hero: '100vw',
};
