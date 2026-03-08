import React, { createContext, useContext, useState, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue>({
  activeTab: '',
  setActiveTab: () => undefined,
});

function useTabsContext() {
  return useContext(TabsContext);
}

// ---------------------------------------------------------------------------
// Tabs (root)
// ---------------------------------------------------------------------------

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Controlled active tab value */
  value?: string;
  /** Default active tab for uncontrolled usage */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  ({ value, defaultValue = '', onValueChange, className, children, ...props }, ref) => {
    const [internalValue, setInternalValue] = useState(defaultValue);
    const isControlled = value !== undefined;
    const activeTab = isControlled ? value : internalValue;

    const setActiveTab = (next: string) => {
      if (!isControlled) setInternalValue(next);
      onValueChange?.(next);
    };

    return (
      <TabsContext.Provider value={{ activeTab, setActiveTab }}>
        <div ref={ref} className={cn('flex flex-col', className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  },
);

Tabs.displayName = 'Tabs';

// ---------------------------------------------------------------------------
// TabsList
// ---------------------------------------------------------------------------

interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {}

export const TabsList = forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="tablist"
        className={cn(
          'flex items-center gap-0 border-b border-border',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

TabsList.displayName = 'TabsList';

// ---------------------------------------------------------------------------
// TabsTrigger
// ---------------------------------------------------------------------------

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value, disabled = false, className, children, ...props }, ref) => {
    const { activeTab, setActiveTab } = useTabsContext();
    const isActive = activeTab === value;

    return (
      <button
        ref={ref}
        role="tab"
        type="button"
        aria-selected={isActive}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={() => !disabled && setActiveTab(value)}
        className={cn(
          'px-4 py-2 text-[11px] font-mono uppercase tracking-widest',
          'transition-all duration-150 -mb-px border-b-2',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan',
          isActive
            ? 'text-cyan border-cyan'
            : 'text-text-dim border-transparent hover:text-text hover:border-border-hi',
          disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);

TabsTrigger.displayName = 'TabsTrigger';

// ---------------------------------------------------------------------------
// TabsContent
// ---------------------------------------------------------------------------

interface TabsContentProps {
  value: string;
  children?: React.ReactNode;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
}

export const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value, className, children, id, style }, ref) => {
    const { activeTab } = useTabsContext();
    if (activeTab !== value) return null;

    return (
      <motion.div
        ref={ref}
        role="tabpanel"
        id={id}
        style={style}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className={cn('pt-4', className)}
      >
        {children}
      </motion.div>
    );
  },
);

TabsContent.displayName = 'TabsContent';

export type { TabsProps, TabsListProps, TabsTriggerProps, TabsContentProps };
