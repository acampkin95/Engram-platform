import { useRef, useCallback, useEffect } from 'react';

export interface UseCancelTokenReturn {
  signal: AbortSignal;
  cancel: (reason?: string) => void;
  reset: () => AbortSignal;
}

export function useCancelToken(): UseCancelTokenReturn {
  const controllerRef = useRef(new AbortController());

  const cancel = useCallback((reason?: string) => {
    controllerRef.current.abort(reason ?? 'Request cancelled');
  }, []);

  const reset = useCallback((): AbortSignal => {
    controllerRef.current.abort('Request superseded');
    controllerRef.current = new AbortController();
    return controllerRef.current.signal;
  }, []);

  useEffect(() => {
    return () => {
      controllerRef.current.abort('Component unmounted');
    };
  }, []);

  return {
    signal: controllerRef.current.signal,
    cancel,
    reset,
  };
}
