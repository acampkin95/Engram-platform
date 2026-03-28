'use client';

import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const springTransition = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 30,
  mass: 0.8,
};

const smoothEase = [0.22, 1, 0.36, 1] as const;

const defaultVariants: Variants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(4px)' },
  enter: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -8, filter: 'blur(4px)' },
};

const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  enter: { opacity: 1 },
  exit: { opacity: 0 },
};

const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97, filter: 'blur(2px)' },
  enter: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 0.97, filter: 'blur(2px)' },
};

const slideVariants: Variants = {
  hidden: { opacity: 0, x: -16 },
  enter: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 16 },
};

interface PageTransitionProps {
  children: ReactNode;
  variant?: 'default' | 'fade' | 'scale' | 'slide';
  className?: string;
}

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
    slide: slideVariants,
  };

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={variants[variant]}
        initial="hidden"
        animate="enter"
        exit="exit"
        transition={{
          duration: 0.25,
          ease: smoothEase,
        }}
        className={className}
        style={{ willChange: 'opacity, transform, filter' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  y?: number;
}

export function FadeIn({
  children,
  delay = 0,
  duration = 0.35,
  className = '',
  y = 12,
}: FadeInProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: smoothEase }}
      className={className}
      style={{ willChange: 'opacity, transform' }}
    >
      {children}
    </motion.div>
  );
}

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
  duration = 0.35,
  className = '',
}: SlideInProps) {
  const shouldReduceMotion = useReducedMotion();

  const directionOffset = 16;
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
      transition={{ duration, delay, ease: smoothEase }}
      className={className}
      style={{ willChange: 'opacity, transform' }}
    >
      {children}
    </motion.div>
  );
}

interface ScaleInProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function ScaleIn({ children, delay = 0, className = '' }: ScaleInProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...springTransition, delay }}
      className={className}
      style={{ willChange: 'opacity, transform' }}
    >
      {children}
    </motion.div>
  );
}
