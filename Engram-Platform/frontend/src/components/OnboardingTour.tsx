'use client';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/src/lib/utils';
import { usePreferencesStore } from '@/src/stores/preferencesStore';

interface TourStep {
  id: string;
  title: string;
  content: string;
  target?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: {
    label: string;
    onClick: () => void;
  };
}

const DEFAULT_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Engram',
    content:
      "Engram is your AI memory platform. It stores, searches, and connects information across your projects. Let's take a quick tour.",
    placement: 'center',
    action: { label: 'Start tour', onClick: () => {} },
  },
  {
    id: 'sidebar',
    title: 'Navigation Sidebar',
    content:
      'Use the sidebar to navigate between Crawler, Memory, Intelligence, and Admin sections. Click the chevron to collapse for more space.',
    target: '[aria-label="Main navigation"]',
    placement: 'right',
    action: { label: 'Got it', onClick: () => {} },
  },
  {
    id: 'cmd-palette',
    title: 'Command Palette',
    content:
      'Press ⌘K (or Ctrl+K) anywhere to open the command palette. Search for pages, actions, or settings instantly.',
    placement: 'bottom',
    action: { label: 'Next', onClick: () => {} },
  },
  {
    id: 'memory',
    title: 'Memory System',
    content:
      'Add memories manually or let the crawler discover information. Use Matters to organise related memories into cases or projects.',
    target: 'a[href*="/dashboard/memory"]',
    placement: 'right',
    action: { label: 'Next', onClick: () => {} },
  },
  {
    id: 'crawler',
    title: 'OSINT Crawler',
    content:
      'The Crawler discovers and analyses web content automatically. Run investigations to build comprehensive intelligence reports.',
    target: 'a[href*="/dashboard/crawler"]',
    placement: 'right',
    action: { label: 'Finish tour', onClick: () => {} },
  },
];

interface OnboardingTourProps {
  steps?: TourStep[];
  onComplete?: () => void;
}

export function OnboardingTour({ steps = DEFAULT_STEPS, onComplete }: OnboardingTourProps) {
  const completed = usePreferencesStore((s) => s.onboardingCompleted);
  const complete = usePreferencesStore((s) => s.completeOnboarding);
  const [current, setCurrent] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const step = steps[current];
  const total = steps.length;
  const isLast = current === total - 1;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (completed || !mounted || !step?.target) {
      setTargetRect(null);
      return;
    }

    const targetSelector = step.target;

    const findTarget = () => {
      const el = targetSelector ? document.querySelector(targetSelector) : null;
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      }
    };

    findTarget();
    const observer = new ResizeObserver(findTarget);
    const mutationObserver = new MutationObserver(findTarget);

    const el = targetSelector ? document.querySelector(targetSelector) : null;
    if (el) {
      observer.observe(el);
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    const timer = setTimeout(findTarget, 100);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [step, mounted, completed]);

  const handleNext = useCallback(() => {
    if (isLast) {
      complete();
      onComplete?.();
    } else {
      setCurrent((c) => c + 1);
    }
  }, [isLast, complete, onComplete]);

  const handleSkip = useCallback(() => {
    complete();
    onComplete?.();
  }, [complete, onComplete]);

  if (!mounted || completed) return null;

  const overlay = (
    <div
      className="fixed inset-0 z-[180] select-none"
      aria-modal="true"
      role="dialog"
      aria-label={`Onboarding: ${step.title}`}
    >
      {targetRect && step.target && step.placement !== 'center' && (
        <div
          className="absolute border-2 border-[#F2A93B] rounded-xl pointer-events-none"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: '0 0 0 4px rgba(242, 169, 59, 0.15)',
          }}
        />
      )}

      <div
        className={cn(
          'absolute z-10 w-80 rounded-2xl bg-[#090818] border border-white/[0.08] shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200',
          step.placement === 'center' && 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
          step.placement === 'bottom' &&
            targetRect &&
            'fixed top-[calc(var(--spot-top)+8px)] left-[calc(var(--spot-left)+var(--spot-width)/2-10rem)]',
          step.placement === 'right' &&
            targetRect &&
            'fixed top-[calc(var(--spot-top)+var(--spot-height)/2-5rem)] left-[calc(var(--spot-left)+var(--spot-width)+16px)]',
        )}
        style={
          targetRect
            ? ({
                '--spot-top': `${targetRect.top}px`,
                '--spot-left': `${targetRect.left}px`,
                '--spot-width': `${targetRect.width}px`,
                '--spot-height': `${targetRect.height}px`,
              } as React.CSSProperties)
            : undefined
        }
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#f0eef8] font-display">{step.title}</h3>
            <button
              type="button"
              onClick={handleSkip}
              className="text-[#5c5878] hover:text-[#f0eef8] transition-colors text-xs"
              aria-label="Skip tour"
            >
              Skip
            </button>
          </div>
          <p className="text-xs text-[#a09bb8] leading-relaxed mb-5">{step.content}</p>
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {steps.map((s, i) => (
                <div
                  key={s.id}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-200',
                    i === current ? 'w-6 bg-[#F2A93B]' : 'w-1.5 bg-white/[0.08]',
                  )}
                />
              ))}
            </div>
            <div className="flex gap-2">
              {current > 0 && (
                <button
                  type="button"
                  onClick={() => setCurrent((c) => c - 1)}
                  className="rounded-lg px-3 py-1.5 text-xs text-[#a09bb8] hover:text-[#f0eef8] hover:bg-white/[0.06] transition-colors"
                >
                  Back
                </button>
              )}
              {step.action && (
                <button
                  type="button"
                  onClick={() => {
                    step.action?.onClick();
                    handleNext();
                  }}
                  className="rounded-lg bg-[#F2A93B] px-3 py-1.5 text-xs font-semibold text-[#03020a] hover:bg-[#ffc15e] transition-colors"
                >
                  {step.action.label}
                </button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-[#3a3850] font-mono mt-3">
            {current + 1} of {total}
          </p>
        </div>
      </div>

      <div className="fixed inset-0 bg-black/50" onClick={handleSkip} aria-hidden="true" />
    </div>
  );

  return createPortal(overlay, document.body);
}
