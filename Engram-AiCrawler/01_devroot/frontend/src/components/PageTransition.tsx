import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useReducedMotion } from '../lib/motion';

interface PageTransitionProps {
  children: ReactNode;
}

const variants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const reducedVariants = {
  initial: { opacity: 0 },
  enter: { opacity: 1 },
  exit: { opacity: 0 },
};

const transition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.2,
};

const reducedTransition = {
  type: 'tween',
  duration: 0.01,
};

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const prefersReduced = useReducedMotion();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial="initial"
        animate="enter"
        exit="exit"
        variants={prefersReduced ? reducedVariants : variants}
        transition={prefersReduced ? reducedTransition : transition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
