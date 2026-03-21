'use client';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

interface LiveRegionContextValue {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
}

const LiveRegionContext = createContext<LiveRegionContextValue>({ announce: () => {} });

export function LiveRegionProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (priority === 'assertive') {
      setAssertive(message);
    } else {
      setPolite(message);
    }
  }, []);

  useEffect(() => {
    if (polite) {
      const timer = setTimeout(() => setPolite(''), 1000);
      return () => clearTimeout(timer);
    }
  }, [polite]);

  useEffect(() => {
    if (assertive) {
      const timer = setTimeout(() => setAssertive(''), 1000);
      return () => clearTimeout(timer);
    }
  }, [assertive]);

  return (
    <LiveRegionContext.Provider value={{ announce }}>
      {children}
      <output aria-live="polite" aria-atomic="true" className="sr-only">
        {polite}
      </output>
      <div aria-live="assertive" aria-atomic="true" className="sr-only" role="alert">
        {assertive}
      </div>
    </LiveRegionContext.Provider>
  );
}

export function useLiveRegion() {
  return useContext(LiveRegionContext);
}
