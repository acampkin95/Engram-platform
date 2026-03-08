import { useCallback, useEffect, useRef, useState } from 'react';
import { useOsintStore } from '../stores/osintStore';

// ---------------------------------------------------------------------------
// useWhoisLookup — domain, DNS, and IP lookups
// ---------------------------------------------------------------------------

export function useWhoisLookup() {
  const {
    whoisResult,
    dnsResult,
    ipResult,
    isServiceLoading,
    error,
    fetchWhois,
    fetchDns,
    fetchIp,
    clearError,
  } = useOsintStore();

  const lookupDomain = useCallback(
    async (domain: string) => {
      await Promise.all([fetchWhois(domain), fetchDns(domain)]);
    },
    [fetchWhois, fetchDns]
  );

  return {
    whoisResult,
    dnsResult,
    ipResult,
    isLoading: isServiceLoading('whois') || isServiceLoading('dns') || isServiceLoading('ip'),
    error,
    lookupDomain,
    lookupDns: fetchDns,
    lookupIp: fetchIp,
    clearError,
  };
}

// ---------------------------------------------------------------------------
// useThreatIntel — Shodan, VirusTotal, IP reputation
// ---------------------------------------------------------------------------

export function useThreatIntel() {
  const {
    shodanResult,
    vtResult,
    ipRepResult,
    isServiceLoading,
    error,
    fetchShodan,
    fetchVt,
    fetchIpRep,
    clearError,
  } = useOsintStore();

  return {
    shodanResult,
    vtResult,
    ipRepResult,
    isLoading: isServiceLoading('shodan') || isServiceLoading('virustotal') || isServiceLoading('ip-reputation'),
    error,
    searchShodan: fetchShodan,
    checkVirusTotal: fetchVt,
    checkIpReputation: fetchIpRep,
    clearError,
  };
}

// ---------------------------------------------------------------------------
// useEmailOsint — breach checking, verification, reverse lookup
// ---------------------------------------------------------------------------

export function useEmailOsint() {
  const {
    breachResult,
    emailVerifyResult,
    emailReverseResult,
    bulkEmailResult,
    isServiceLoading,
    error,
    fetchBreach,
    fetchEmailVerify,
    fetchEmailReverse,
    fetchBulkEmail,
    clearError,
  } = useOsintStore();

  const fullEmailCheck = useCallback(
    async (email: string) => {
      await Promise.all([
        fetchBreach(email),
        fetchEmailVerify(email),
        fetchEmailReverse(email),
      ]);
    },
    [fetchBreach, fetchEmailVerify, fetchEmailReverse]
  );

  return {
    breachResult,
    emailVerifyResult,
    emailReverseResult,
    bulkEmailResult,
    isLoading: isServiceLoading('breach') || isServiceLoading('email-verify') || isServiceLoading('email-reverse') || isServiceLoading('bulk-email'),
    error,
    checkBreach: fetchBreach,
    verifyEmail: fetchEmailVerify,
    reverseLookup: fetchEmailReverse,
    bulkCheck: fetchBulkEmail,
    fullEmailCheck,
    clearError,
  };
}

// ---------------------------------------------------------------------------
// useProviderStatus — polls provider availability
// ---------------------------------------------------------------------------

export function useProviderStatus(pollIntervalMs = 60_000) {
  const { providerStatus, fetchProviderStatus } = useOsintStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchProviderStatus();

    if (pollIntervalMs > 0) {
      intervalRef.current = setInterval(fetchProviderStatus, pollIntervalMs);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchProviderStatus, pollIntervalMs]);

  return {
    providerStatus,
    refresh: fetchProviderStatus,
  };
}

// ---------------------------------------------------------------------------
// useOsintClear — utility to clear all OSINT results
// ---------------------------------------------------------------------------

export function useOsintClear() {
  const { clearResults, clearError } = useOsintStore();
  return { clearResults, clearError };
}

// ---------------------------------------------------------------------------
// useDebouncedOsintSearch — debounced unified search for OSINT dashboard
// ---------------------------------------------------------------------------

export function useDebouncedOsintSearch(delayMs = 300) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const setQuery = useCallback((query: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, delayMs);
  }, [delayMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { debouncedQuery, setQuery };
}
