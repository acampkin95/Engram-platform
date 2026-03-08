'use client';

import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

// ─── Page Transition Variants ─────────────────────────────────────────────

const defaultVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  enter: { opacity: 1 },
  exit: { opacity: 0 },
};

const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  enter: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
};

// ─── Props ─────────────────────────────────────────────────────────────────

interface PageTransitionProps {
  children: ReactNode;
  variant?: 'default' | 'fade' | 'scale';
  className?: string;
}

// ─── Page Transition Component ─────────────────────────────────────────────

export function PageTransition({
  children,
  variant = 'default',
  className = '',
}: PageTransitionProps) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();

  const variants = {
    default: defaultVariants,
    fade: fadeVariants,
    scale: scaleVariants,
  };

  // If reduced motion is preferred, skip animations entirely
  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        variants={variants[variant]}
        initial="hidden"
        animate="enter"
        exit="exit"
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Fade In Wrapper ──────────────────────────────────────────────────────

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export function FadeIn({ children, delay = 0, duration = 0.3, className = '' }: FadeInProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Slide In Wrapper ─────────────────────────────────────────────────────

interface SlideInProps {
  children: ReactNode;
  direction?: 'left' | 'right' | 'up' | 'down';
  delay?: number;
  duration?: number;
  className?: string;
}

export function SlideIn({
  children,
  direction = 'up',
  delay = 0,
  duration = 0.3,
  className = '',
}: SlideInProps) {
  const shouldReduceMotion = useReducedMotion();

  const directionOffset = 20;
  const directionMap = {
    left: { x: -directionOffset, y: 0 },
    right: { x: directionOffset, y: 0 },
    up: { x: 0, y: directionOffset },
    down: { x: 0, y: -directionOffset },
  };

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, ...directionMap[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
