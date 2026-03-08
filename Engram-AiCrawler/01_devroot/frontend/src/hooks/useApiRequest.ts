import { useState, useCallback, useRef, useEffect } from 'react';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { api, ApiError } from '../lib/api';

export interface UseApiRequestState<T> {
  data: T | null;
  error: ApiError | null;
  isLoading: boolean;
}

export interface UseApiRequestReturn<T> extends UseApiRequestState<T> {
  execute: (config: AxiosRequestConfig) => Promise<T | null>;
  cancel: (reason?: string) => void;
  reset: () => void;
}

export function useApiRequest<T = unknown>(): UseApiRequestReturn<T> {
  const [state, setState] = useState<UseApiRequestState<T>>({
    data: null,
    error: null,
    isLoading: false,
  });

  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort('Component unmounted');
    };
  }, []);

  const cancel = useCallback((reason?: string) => {
    controllerRef.current?.abort(reason ?? 'Request cancelled');
    controllerRef.current = null;
  }, []);

  const reset = useCallback(() => {
    cancel();
    setState({ data: null, error: null, isLoading: false });
  }, [cancel]);

  const execute = useCallback(async (config: AxiosRequestConfig): Promise<T | null> => {
    controllerRef.current?.abort('Superseded by new request');

    const controller = new AbortController();
    controllerRef.current = controller;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response: AxiosResponse<T> = await api.request<T>({
        ...config,
        signal: controller.signal,
      });

      if (mountedRef.current) {
        setState({ data: response.data, error: null, isLoading: false });
      }
      return response.data;
    } catch (err) {
      if (!mountedRef.current) return null;

      if (axios.isCancel(err)) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return null;
      }

      const apiError =
        err instanceof ApiError
          ? err
          : new ApiError(err instanceof Error ? err.message : 'Unknown error');

      setState({ data: null, error: apiError, isLoading: false });
      return null;
    }
  }, []);

  return {
    ...state,
    execute,
    cancel,
    reset,
  };
}
