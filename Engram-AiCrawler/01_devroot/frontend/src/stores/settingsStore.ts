import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient, { ApiError } from '../lib/api';
import { createLogger } from '../lib/logger';
import { SettingsSchema } from '../lib/schemas';
const log = createLogger('settingsStore');

// Backend API shape (from Task 1.4)
export interface BackendSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  crawl_defaults: {
    extraction_type: 'css' | 'llm' | 'regex' | 'cosine';
    word_count_threshold: number;
    wait_for: string;
    screenshot: boolean;
    pdf: boolean;
  };
  connections: {
    lm_studio_url: string;
    redis_url: string;
  };
  notifications: {
    crawl_complete: boolean;
    crawl_error: boolean;
    scan_complete: boolean;
  };
  network_privacy: {
    proxy_url: string;
    user_agent_mode: 'default' | 'rotate' | 'custom';
    custom_user_agent: string;
    dns_over_https: boolean;
  };
  osint?: {
    osint_shodan_key?: string;
    osint_virustotal_key?: string;
    osint_hunter_key?: string;
    osint_hibp_key?: string;
    osint_whois_key?: string;
    osint_enable_whois?: boolean;
    osint_enable_threat?: boolean;
    osint_enable_email?: boolean;
  };
}

// Legacy local-only settings (preserved for backward compat)
export interface ProxyConfig {
  enabled: boolean;
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol: 'http' | 'https' | 'socks5';
}

export interface Settings extends BackendSettings {
  // Legacy / UI-only fields kept for backward compat
  sidebarCollapsed: boolean;
}

interface SettingsState {
  settings: Settings;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;

  // Actions
  fetchSettings: () => Promise<void>;
  updateSettings: (partial: Partial<BackendSettings>) => void;
  saveSettings: () => Promise<void>;
  resetToDefaults: () => void;
  clearError: () => void;
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  language: 'en',
  sidebarCollapsed: false,
  crawl_defaults: {
    extraction_type: 'css',
    word_count_threshold: 50,
    wait_for: '',
    screenshot: false,
    pdf: false,
  },
  connections: {
    lm_studio_url: 'http://localhost:1234',
    redis_url: 'redis://localhost:6379',
  },
  notifications: {
    crawl_complete: true,
    crawl_error: true,
    scan_complete: false,
  },
  network_privacy: {
    proxy_url: '',
    user_agent_mode: 'default',
    custom_user_agent: '',
    dns_over_https: false,
  },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      isLoading: false,
      isSaving: false,
      error: null,
      hasUnsavedChanges: false,

      fetchSettings: async () => {
        set({ isLoading: true, error: null });
        try {
          const { data: raw } = await apiClient.get('/settings');
          // Validate with Zod (partial — only BackendSettings fields)
          const parseResult = SettingsSchema.safeParse(raw);
          if (!parseResult.success && import.meta.env.DEV) {
            log.validationWarning(parseResult.error.issues);
          }
          const data: BackendSettings = parseResult.success ? parseResult.data : raw as BackendSettings;
          set((state) => ({
            settings: {
              ...state.settings,
              ...data,
            },
            isLoading: false,
            hasUnsavedChanges: false,
          }));
        } catch (err) {
          // Fall back to cached/default settings silently
          set({
            isLoading: false,
            error: err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to load settings',
          });
        }
      },

      updateSettings: (partial) => {
        set((state) => ({
          settings: mergeDeep(
            state.settings as unknown as Record<string, unknown>,
            partial as unknown as Record<string, unknown>
          ) as unknown as Settings,
          hasUnsavedChanges: true,
        }));
      },

      saveSettings: async () => {
        set({ isSaving: true, error: null });
        const { settings } = get();
        // Strip UI-only fields before sending to backend
        const { sidebarCollapsed: _sidebar, ...backendPayload } = settings;
        try {
          await apiClient.put('/settings', backendPayload);
          set({ isSaving: false, hasUnsavedChanges: false });
        } catch (err) {
          set({
            isSaving: false,
            error: err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to save settings',
          });
          throw err;
        }
      },

      resetToDefaults: () => {
        set({
          settings: DEFAULT_SETTINGS,
          hasUnsavedChanges: true,
          error: null,
        });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'crawl4ai-settings',
      // Only persist the settings object (cache), not transient state
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);

// Deep merge helper for nested settings updates
function mergeDeep(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const output = { ...target };
  for (const key in source) {
    const sourceVal = source[key];
    const targetVal = target[key];
    if (
      sourceVal !== null &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      output[key] = mergeDeep(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>
      );
    } else {
      output[key] = sourceVal;
    }
  }
  return output;
}
