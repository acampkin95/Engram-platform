import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { osintApi } from '../lib/api';
import { createLogger } from '../lib/logger';
import {
  WhoisLookupResponseSchema,
  DnsLookupResponseSchema,
  IpLookupResponseSchema,
  ShodanSearchResponseSchema,
  VirusTotalResultSchema,
  IpReputationResponseSchema,
  BreachCheckResponseSchema,
  EmailVerifyResponseSchema,
  EmailReverseResponseSchema,
  BulkEmailCheckResponseSchema,
  ProviderStatusResponseSchema,
} from '../lib/schemas';
import type {
  WhoisLookupResponse,
  DnsLookupResponse,
  IpLookupResponse,
  ShodanSearchResponse,
  VirusTotalResult,
  IpReputationResponse,
  BreachCheckResponse,
  EmailVerifyResponse,
  EmailReverseResponse,
  BulkEmailCheckResponse,
  ProviderStatusResponse,
} from '../lib/schemas';

const log = createLogger('osintStore');

interface OsintState {
  // Results
  whoisResult: WhoisLookupResponse | null;
  dnsResult: DnsLookupResponse | null;
  ipResult: IpLookupResponse | null;
  shodanResult: ShodanSearchResponse | null;
  vtResult: VirusTotalResult | null;
  ipRepResult: IpReputationResponse | null;
  breachResult: BreachCheckResponse | null;
  emailVerifyResult: EmailVerifyResponse | null;
  emailReverseResult: EmailReverseResponse | null;
  bulkEmailResult: BulkEmailCheckResponse | null;
  providerStatus: ProviderStatusResponse | null;

  // UI state — per-service loading map replaces single loading boolean
  loadingServices: Record<string, boolean>;
  error: string | null;

  // Selector helper
  isServiceLoading: (service: string) => boolean;

  // Actions — WHOIS/DNS
  fetchWhois: (domain: string) => Promise<void>;
  fetchDns: (domain: string, recordTypes?: string[]) => Promise<void>;
  fetchIp: (ip: string) => Promise<void>;

  // Actions — Threat Intel
  fetchShodan: (query: string, limit?: number) => Promise<void>;
  fetchVt: (indicator: string, indicatorType?: string) => Promise<void>;
  fetchIpRep: (ip: string) => Promise<void>;

  // Actions — Email
  fetchBreach: (email: string) => Promise<void>;
  fetchEmailVerify: (email: string) => Promise<void>;
  fetchEmailReverse: (email: string) => Promise<void>;
  fetchBulkEmail: (emails: string[]) => Promise<void>;

  // Actions — Provider
  fetchProviderStatus: () => Promise<void>;

  // Utilities
  clearResults: () => void;
  clearError: () => void;
}

function validate<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { issues: unknown[] } } }, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success && result.data !== undefined) return result.data;
  if (import.meta.env.DEV && result.error) {
    log.validationWarning(result.error.issues);
  }
  return data as T;
}

function setLoading(serviceName: string, value: boolean) {
  return (state: OsintState) => ({
    loadingServices: { ...state.loadingServices, [serviceName]: value },
  });
}

export const useOsintStore = create<OsintState>()(
  persist(
    (set, get) => ({
      whoisResult: null,
      dnsResult: null,
      ipResult: null,
      shodanResult: null,
      vtResult: null,
      ipRepResult: null,
      breachResult: null,
      emailVerifyResult: null,
      emailReverseResult: null,
      bulkEmailResult: null,
      providerStatus: null,
      loadingServices: {},
      error: null,

      isServiceLoading: (service: string) => get().loadingServices[service] ?? false,

      fetchWhois: async (domain) => {
        set(setLoading('whois', true));
        set({ error: null });
        try {
          const { data } = await osintApi.whoisDomain(domain);
          set({ whoisResult: validate(WhoisLookupResponseSchema, data) });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'WHOIS lookup failed' });
        } finally {
          set(setLoading('whois', false));
        }
      },

      fetchDns: async (domain, recordTypes) => {
        set(setLoading('dns', true));
        set({ error: null });
        try {
          const { data } = await osintApi.whoisDns(domain, recordTypes);
          set({ dnsResult: validate(DnsLookupResponseSchema, data) });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'DNS lookup failed' });
        } finally {
          set(setLoading('dns', false));
        }
      },

      fetchIp: async (ip) => {
        set(setLoading('ip', true));
        set({ error: null });
        try {
          const { data } = await osintApi.whoisIp(ip);
          set({ ipResult: validate(IpLookupResponseSchema, data) });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'IP lookup failed' });
        } finally {
          set(setLoading('ip', false));
        }
      },

      fetchShodan: async (query, limit) => {
        set(setLoading('shodan', true));
        set({ error: null });
        try {
          const { data } = await osintApi.threatShodan(query, limit);
          set({ shodanResult: validate(ShodanSearchResponseSchema, data) });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Shodan search failed' });
        } finally {
          set(setLoading('shodan', false));
        }
      },

      fetchVt: async (indicator, indicatorType) => {
        set(setLoading('virustotal', true));
        set({ error: null });
        try {
          const { data } = await osintApi.threatVt(indicator, indicatorType);
          set({ vtResult: validate(VirusTotalResultSchema, data) });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'VirusTotal check failed' });
        } finally {
          set(setLoading('virustotal', false));
        }
      },

      fetchIpRep: async (ip) => {
        set(setLoading('ip-reputation', true));
        set({ error: null });
        try {
          const { data } = await osintApi.threatIpRep(ip);
          set({ ipRepResult: validate(IpReputationResponseSchema, data) });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'IP reputation check failed' });
        } finally {
          set(setLoading('ip-reputation', false));
        }
      },

      fetchBreach: async (email) => {
        set(setLoading('breach', true));
        set({ error: null });
        try {
          const { data } = await osintApi.emailBreach(email);
          set({ breachResult: validate(BreachCheckResponseSchema, data) });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Breach check failed' });
        } finally {
          set(setLoading('breach', false));
        }
      },

      fetchEmailVerify: async (email) => {
        set(setLoading('email-verify', true));
        set({ error: null });
        try {
          const { data } = await osintApi.emailVerify(email);
          set({ emailVerifyResult: validate(EmailVerifyResponseSchema, data) });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Email verification failed' });
        } finally {
          set(setLoading('email-verify', false));
        }
      },

      fetchEmailReverse: async (email) => {
        set(setLoading('email-reverse', true));
        set({ error: null });
        try {
          const { data } = await osintApi.emailReverse(email);
          set({ emailReverseResult: validate(EmailReverseResponseSchema, data) });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Email reverse lookup failed' });
        } finally {
          set(setLoading('email-reverse', false));
        }
      },

      fetchBulkEmail: async (emails) => {
        set(setLoading('bulk-email', true));
        set({ error: null });
        try {
          const { data } = await osintApi.emailBulk(emails);
          set({ bulkEmailResult: validate(BulkEmailCheckResponseSchema, data) });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Bulk email check failed' });
        } finally {
          set(setLoading('bulk-email', false));
        }
      },

      fetchProviderStatus: async () => {
        try {
          const { data } = await osintApi.providerStatus();
          set({ providerStatus: validate(ProviderStatusResponseSchema, data) });
        } catch (err) {
          if (import.meta.env.DEV) {
            console.warn('Failed to fetch provider status:', err);
          }
        }
      },

      clearResults: () =>
        set({
          whoisResult: null,
          dnsResult: null,
          ipResult: null,
          shodanResult: null,
          vtResult: null,
          ipRepResult: null,
          breachResult: null,
          emailVerifyResult: null,
          emailReverseResult: null,
          bulkEmailResult: null,
          error: null,
          loadingServices: {},
        }),

      clearError: () => set({ error: null }),
    }),
    {
      name: 'osint-store',
      partialize: (state) => ({
        providerStatus: state.providerStatus,
      }),
    }
  )
);
