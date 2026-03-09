"use client";

import { clsx } from "clsx";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Bell,
  Check,
  Database,
  Globe,
  Key,
  Palette,
  RotateCcw,
  Save,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useHealth } from "@/hooks/useHealth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Toast {
  id: string;
  type: "success" | "error";
  message: string;
}

export default function SettingsPage() {
  const { data: health, isLoading: healthLoading } = useHealth();
  const isApiConnected = health?.weaviate && health?.redis;
  const [apiUrl, setApiUrl] = useState(API_URL);
  const [defaultTenant, setDefaultTenant] = useState(
    typeof window !== "undefined"
      ? localStorage.getItem("memory_default_tenant") || "default"
      : "default"
  );
  const [defaultProject, setDefaultProject] = useState(
    typeof window !== "undefined"
      ? localStorage.getItem("memory_default_project") || "default"
      : "default"
  );
  const [toast, setToast] = useState<Toast | null>(null);
  const [saving, setSaving] = useState(false);

  // Toggle states - load from localStorage with fallback to defaults
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("engram_dark_mode");
    return saved !== null ? saved === "true" : true;
  });
  const [animations, setAnimations] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("engram_animations");
    return saved !== null ? saved === "true" : true;
  });
  const [connectionAlerts, setConnectionAlerts] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("engram_connection_alerts");
    return saved !== null ? saved === "true" : true;
  });

  // Apply dark mode and animations to DOM
  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.classList.toggle("dark", darkMode);
    document.documentElement.style.setProperty("--animations-enabled", animations ? "1" : "0");
    localStorage.setItem("engram_dark_mode", String(darkMode));
    localStorage.setItem("engram_animations", String(animations));
  }, [darkMode, animations]);

  // Persist connectionAlerts immediately on toggle
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("engram_connection_alerts", String(connectionAlerts));
  }, [connectionAlerts]);

  const showToast = (type: "success" | "error", message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToast({ id, type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validate API URL
      const res = await fetch(`${apiUrl}/health`);
      if (!res.ok) throw new Error("Cannot connect to API");

      // Save to localStorage
      localStorage.setItem("memory_default_tenant", defaultTenant);
      localStorage.setItem("memory_default_project", defaultProject);
      localStorage.setItem("memory_api_url", apiUrl);

      showToast("success", "Settings saved successfully!");
    } catch {
      showToast("error", "Failed to connect to API. Please check the URL.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setApiUrl(API_URL);
    setDefaultTenant("default");
    setDefaultProject("default");
    localStorage.removeItem("memory_default_tenant");
    localStorage.removeItem("memory_default_project");
    localStorage.removeItem("memory_api_url");
    showToast("success", "Settings reset to defaults");
  };

  return (
    <motion.div
      className="space-y-6 max-w-3xl animate-page-enter"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Settings
        </h1>
        <p className="text-[#5C5878]">Configure your ENGRAM dashboard</p>
      </div>

      {/* Toast Notification */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={clsx(
            "fixed top-4 right-4 px-4 py-3 rounded-xl border flex items-center gap-2 shadow-lg z-50",
            toast.type === "success"
              ? "bg-teal-900/90 border-teal-700 text-teal-300"
              : "bg-red-900/90 border-red-700 text-red-300"
          )}
        >
          {toast.type === "success" ? (
            <Check className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </motion.div>
      )}

      {/* Connection Settings */}
      <section className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Database className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#f0eef8]">Connection</h2>
            <p className="text-xs text-[#a09bb8]">API endpoint configuration</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label
              htmlFor="api-url"
              className="block text-xs text-[#a09bb8] uppercase tracking-wider mb-2"
            >
              API URL
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a09bb8]" />
              <input
                id="api-url"
                type="url"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:8000"
                className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-[#F0EEF8] placeholder-[#5C5878] focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-all"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Default Context Settings */}
      <section className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <Key className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#f0eef8]">Default Context</h2>
            <p className="text-xs text-[#a09bb8]">Default tenant and project</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="default-tenant"
                className="block text-xs text-[#a09bb8] uppercase tracking-wider mb-2"
              >
                Default Tenant
              </label>
              <input
                id="default-tenant"
                type="text"
                value={defaultTenant}
                onChange={(e) => setDefaultTenant(e.target.value)}
                placeholder="default"
                className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-[#F0EEF8] placeholder-[#5C5878] focus:outline-none focus:border-amber-500/40"
              />
            </div>

            <div>
              <label
                htmlFor="default-project"
                className="block text-xs text-[#a09bb8] uppercase tracking-wider mb-2"
              >
                Default Project
              </label>
              <input
                id="default-project"
                type="text"
                value={defaultProject}
                onChange={(e) => setDefaultProject(e.target.value)}
                placeholder="default"
                className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-[#F0EEF8] placeholder-[#5C5878] focus:outline-none focus:border-amber-500/40"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Display Settings */}
      <section className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Palette className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#f0eef8]">Display</h2>
            <p className="text-xs text-[#a09bb8]">Visual preferences</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#a09bb8]">Dark Mode</p>
              <p className="text-xs text-[#a09bb8]">Always use dark theme</p>
            </div>
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className={clsx(
                "w-11 h-6 rounded-full flex items-center px-0.5 transition-colors",
                darkMode ? "bg-amber-500" : "bg-white/[0.1]"
              )}
            >
              <div
                className={clsx(
                  "w-5 h-5 bg-white rounded-full shadow transform transition-transform",
                  darkMode ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#a09bb8]">Animations</p>
              <p className="text-xs text-[#a09bb8]">Enable UI animations</p>
            </div>
            <button
              type="button"
              onClick={() => setAnimations(!animations)}
              className={clsx(
                "w-11 h-6 rounded-full flex items-center px-0.5 transition-colors",
                animations ? "bg-amber-500" : "bg-white/[0.1]"
              )}
            >
              <div
                className={clsx(
                  "w-5 h-5 bg-white rounded-full shadow transform transition-transform",
                  animations ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
            <Bell className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#f0eef8]">Notifications</h2>
            <p className="text-xs text-[#a09bb8]">Alert preferences</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#a09bb8]">Connection Alerts</p>
              <p className="text-xs text-[#a09bb8]">Notify when API connection fails</p>
            </div>
            <button
              type="button"
              onClick={() => setConnectionAlerts(!connectionAlerts)}
              className={clsx(
                "w-11 h-6 rounded-full flex items-center px-0.5 transition-colors",
                connectionAlerts ? "bg-amber-500" : "bg-white/[0.1]"
              )}
            >
              <div
                className={clsx(
                  "w-5 h-5 bg-white rounded-full shadow transform transition-transform",
                  connectionAlerts ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4">
        <button
          type="button"
          onClick={handleReset}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] text-[#a09bb8] hover:bg-white/[0.08] border border-white/[0.08] transition-colors disabled:opacity-50"
        >
          <RotateCcw className="w-4 h-4" />
          Reset to Defaults
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-[#03020A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Settings
            </>
          )}
        </button>
      </div>

      {/* API Health Check */}
      <section className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={clsx(
                "w-2 h-2 rounded-full",
                healthLoading
                  ? "bg-[#5c5878] animate-pulse"
                  : isApiConnected
                    ? "bg-[#2ec4c4] animate-pulse"
                    : "bg-[#e05c7f]"
              )}
            />
            <span className="text-sm text-[#a09bb8]">
              {healthLoading
                ? "Checking..."
                : isApiConnected
                  ? "API Status: Connected"
                  : "API Status: Disconnected"}
            </span>
          </div>
          <span className="text-xs text-[#5c5878]">{apiUrl}</span>
        </div>
      </section>
    </motion.div>
  );
}
