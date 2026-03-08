'use client';

import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { ReactNode, useCallback } from 'react';

// ─── Animation Variants ───────────────────────────────────────────────────────

// @ts-expect-error - Framer Motion variants type complexity
const fadeInVariant = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

// @ts-expect-error - Framer Motion variants type complexity
const slideInVariant = {
  up: { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } },
  down: { hidden: { opacity: 0, y: -20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } },
  left: { hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0, transition: { duration: 0.4 } } },
  right: { hidden: { opacity: 0, x: 20 }, visible: { opacity: 1, x: 0, transition: { duration: 0.4 } } },
};

const cardStaggerVariant = {
  container: {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.05 },
    },
  },
  item: {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: 'spring', stiffness: 300, damping: 25 },
    },
  },
};

const fastStaggerVariant = {
  container: {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.03, delayChildren: 0.02 },
    },
  },
  item: {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  },
};

// ─── Components ───────────────────────────────────────────────────────────────

export function PageTransition({ children }: { children: ReactNode }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

export function FadeIn({
  children,
  delay = 0,
  className,
  ...props
}: HTMLMotionProps<'div'> & { delay?: number }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={fadeInVariant}
      initial="hidden"
      animate="visible"
      transition={{ duration: shouldReduceMotion ? 0 : 0.35, delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function SlideIn({
  children,
  direction = 'down',
  delay = 0,
  className,
  ...props
}: HTMLMotionProps<'div'> & { direction?: 'up' | 'down' | 'left' | 'right'; delay?: number }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={slideInVariant[direction]}
      initial="hidden"
      animate="visible"
      transition={{ duration: shouldReduceMotion ? 0 : 0.4, delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerContainer({
  children,
  variant = 'card',
  className,
  ...props
}: HTMLMotionProps<'div'> & { variant?: 'card' | 'fast' }) {
  const shouldReduceMotion = useReducedMotion();
  const variants = variant === 'card' ? cardStaggerVariant : fastStaggerVariant;

  return (
    <motion.div
      variants={variants.container}
      initial="hidden"
      animate="show"
      transition={{ duration: shouldReduceMotion ? 0 : 0.5 }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  index = 0,
  className,
  ...props
}: HTMLMotionProps<'div'> & { index?: number }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={cardStaggerVariant.item}
      custom={index}
      initial="hidden"
      animate="show"
      transition={{
        duration: shouldReduceMotion ? 0 : 0.3,
        delay: index * 0.08
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerList<T extends { id: string | number }>({
  items,
  variant = 'card',
  renderItem,
  className,
}: {
  items: T[];
  variant?: 'card' | 'fast';
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
}) {
  return (
    <StaggerContainer variant={variant} className={className}>
      {items.map((item, index) => (
        <StaggerItem key={item.id} index={index}>
          {renderItem(item, index)}
        </StaggerItem>
      ))}
    </StaggerContainer>
  );
}
