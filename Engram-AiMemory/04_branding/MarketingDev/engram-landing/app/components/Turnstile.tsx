'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface TurnstileProps {
  siteKey?: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          theme?: string;
          size?: string;
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

// Cloudflare Turnstile visible widget
// Set NEXT_PUBLIC_TURNSTILE_SITE_KEY in .env or use the test key
const DEFAULT_TEST_KEY = '1x00000000000000000000AA'; // Always passes (test key)

export function Turnstile({
  siteKey,
  onVerify,
  onExpire,
  theme = 'dark',
  size = 'normal',
}: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const key = siteKey || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || DEFAULT_TEST_KEY;

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile || widgetIdRef.current) return;

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: key,
      callback: onVerify,
      'expired-callback': onExpire,
      theme,
      size,
    });
  }, [key, onVerify, onExpire, theme, size]);

  useEffect(() => {
    // Load Turnstile script if not already loaded
    if (window.turnstile) {
      setLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
    script.async = true;

    window.onTurnstileLoad = () => {
      setLoaded(true);
    };

    document.head.appendChild(script);

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (loaded) {
      renderWidget();
    }
  }, [loaded, renderWidget]);

  return (
    <div
      ref={containerRef}
      className="flex justify-center my-4"
      style={{ minHeight: size === 'compact' ? '65px' : '65px' }}
    />
  );
}

// Gated link component — shows Turnstile, then reveals the link
export function TurnstileGatedLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [verified, setVerified] = useState(false);

  if (verified) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {children}
      </a>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="font-[var(--font-mono)] text-xs text-[var(--text-muted)] uppercase tracking-wider">
        Verify to continue
      </p>
      <Turnstile onVerify={() => setVerified(true)} />
    </div>
  );
}
