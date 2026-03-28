'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

const smoothEase = [0.22, 1, 0.36, 1] as const;

export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(2px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 28,
      mass: 0.6,
    },
  },
};

export const fastContainerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.025,
      delayChildren: 0,
    },
  },
};

export const fastItemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.18, ease: smoothEase },
  },
};

export const cardContainerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.06,
    },
  },
};

export const cardItemVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.97, filter: 'blur(3px)' },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      type: 'spring',
      stiffness: 320,
      damping: 24,
      mass: 0.7,
    },
  },
};

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

interface StaggerListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  keyExtractor?: (item: T, index: number) => string | number;
  className?: string;
  itemClassName?: string;
  variant?: 'default' | 'fast' | 'card';
}

export function StaggerList<T>({
  items,
  renderItem,
  keyExtractor,
  className = '',
  itemClassName = '',
  variant = 'default',
}: StaggerListProps<T>) {
  return (
    <StaggerContainer className={className} variant={variant}>
      {items.map((item, index) => (
        <StaggerItem
          key={keyExtractor ? keyExtractor(item, index) : index}
          className={itemClassName}
          variant={variant}
        >
          {renderItem(item, index)}
        </StaggerItem>
      ))}
    </StaggerContainer>
  );
}
