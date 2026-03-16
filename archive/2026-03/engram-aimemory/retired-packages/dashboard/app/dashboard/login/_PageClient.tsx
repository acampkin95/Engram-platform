"use client";

import { useState } from "react";
import { login } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(API_URL, username, password);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#03020A] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 mb-4">
            <svg width="56" height="56" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <rect x="6" y="10" width="36" height="4" rx="2" fill="#F2A93B" opacity="1" />
              <rect x="10" y="17" width="28" height="4" rx="2" fill="#9B7DE0" opacity="0.9" />
              <rect x="14" y="24" width="20" height="4" rx="2" fill="#2EC4C4" opacity="0.8" />
              <rect x="18" y="31" width="12" height="4" rx="2" fill="#7C5CBF" opacity="0.6" />
              <rect x="22" y="38" width="4" height="4" rx="2" fill="#B87B20" opacity="0.4" />
              <line
                x1="24"
                y1="6"
                x2="24"
                y2="45"
                stroke="#F2A93B"
                strokeWidth="1"
                strokeOpacity="0.35"
              />
            </svg>
          </div>
          <h1
            className="text-2xl font-bold tracking-[0.15em] text-[#F0EEF8]"
            style={{ fontFamily: "var(--font-syne, sans-serif)" }}
          >
            ENGRAM
          </h1>
          <p className="text-xs text-[#5C5878] mt-1 font-mono uppercase tracking-wider">
            Multi-Layer Memory System
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-mono text-[#5C5878] uppercase tracking-wider mb-1.5"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[#F0EEF8] placeholder-[#5C5878] focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
              placeholder="admin"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-mono text-[#5C5878] uppercase tracking-wider mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[#F0EEF8] placeholder-[#5C5878] focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-[#03020A] font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* Hint */}
        <p className="text-center text-xs text-[#5C5878] mt-6 font-mono">
          API key access is also supported via <code className="text-[#A09BB8]">X-API-Key</code>{" "}
          header
        </p>
      </div>
    </div>
  );
}
