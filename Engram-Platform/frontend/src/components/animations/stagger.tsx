'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

// ─── Stagger Container Variants ────────────────────────────────────────────

export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
};

// Fast stagger for quick feedback
export const fastContainerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0,
    },
  },
};

export const fastItemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.15, ease: 'easeOut' },
  },
};

// Card grid stagger (for dashboard cards)
export const cardContainerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export const cardItemVariants: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 22,
    },
  },
};

// ─── Stagger Container Component ───────────────────────────────────────────

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'fast' | 'card';
  delay?: number;
}

export function StaggerContainer({
  children,
  className = '',
  variant = 'default',
  delay = 0,
}: StaggerContainerProps) {
  const shouldReduceMotion = useReducedMotion();

  const containerMap = {
    default: containerVariants,
    fast: fastContainerVariants,
    card: cardContainerVariants,
  };

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={containerMap[variant]}
      initial="hidden"
      animate="show"
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Stagger Item Component ────────────────────────────────────────────────

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'fast' | 'card';
}

export function StaggerItem({ children, className = '', variant = 'default' }: StaggerItemProps) {
  const shouldReduceMotion = useReducedMotion();

  const itemMap = {
    default: itemVariants,
    fast: fastItemVariants,
    card: cardItemVariants,
  };

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div variants={itemMap[variant]} className={className}>
      {children}
    </motion.div>
  );
}

// ─── Pre-built Stagger List ────────────────────────────────────────────────

interface StaggerListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  itemClassName?: string;
  variant?: 'default' | 'fast' | 'card';
}

export function StaggerList<T>({
  items,
  renderItem,
  className = '',
  itemClassName = '',
  variant = 'default',
}: StaggerListProps<T>) {
  return (
    <StaggerContainer className={className} variant={variant}>
      {items.map((item, index) => (
        <StaggerItem key={index} className={itemClassName} variant={variant}>
          {renderItem(item, index)}
        </StaggerItem>
      ))}
    </StaggerContainer>
  );
}
