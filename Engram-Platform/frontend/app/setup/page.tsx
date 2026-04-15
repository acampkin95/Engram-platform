'use client';

import { motion } from 'framer-motion';
import { Check, Copy, Loader2, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EngramLogo } from '@/src/design-system/EngramLogo';

type SeedResult = {
  seeded: boolean;
  email?: string;
  password?: string;
  message?: string;
  error?: string;
};

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [alreadySeeded, setAlreadySeeded] = useState(false);

  // Check seed status on mount
  useState(() => {
    fetch('/api/setup/seed')
      .then((r) => r.json())
      .then((data: { seeded: boolean; userCount: number }) => {
        if (data.seeded) {
          setAlreadySeeded(true);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  });

  const handleSeed = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/setup/seed', { method: 'POST' });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ seeded: false, error: 'Network error — is the server running?' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const goToSignIn = () => router.push('/sign-in');

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[#03020A]" />
        <div
          className="absolute rounded-full"
          style={{
            width: '500px',
            height: '500px',
            top: '-10%',
            right: '-10%',
            background: 'radial-gradient(circle, rgba(242,169,59,0.08) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: '400px',
            height: '400px',
            bottom: '-5%',
            left: '-10%',
            background: 'radial-gradient(circle, rgba(124,92,191,0.07) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md px-4"
      >
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] shadow-xl shadow-amber-500/10 backdrop-blur-sm">
            <EngramLogo size={28} />
          </div>
          <h1 className="font-[Syne] text-2xl font-bold tracking-tight text-[#f0eef8]">
            Engram Setup
          </h1>
          <p className="mt-1 font-mono text-sm text-[#8580a0]">Create the initial admin account</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          {checking ? (
            <div className="flex items-center justify-center py-8 text-[#5c5878]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Checking...
            </div>
          ) : alreadySeeded ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-[#2EC4C4]/20 bg-[#2EC4C4]/5 p-4">
                <p className="text-sm text-[#2EC4C4]">
                  An admin account already exists. Sign in to continue.
                </p>
              </div>
              <button
                type="button"
                onClick={goToSignIn}
                className="w-full py-3 rounded-xl bg-[#f2a93b] text-[#03020a] font-[Syne] text-sm font-semibold hover:bg-[#ffc15e] transition-colors"
              >
                Go to Sign In
              </button>
            </div>
          ) : result?.seeded ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-[#2EC4C4]/20 bg-[#2EC4C4]/5 p-3 flex items-center gap-2">
                <Check className="w-4 h-4 text-[#2EC4C4] shrink-0" />
                <p className="text-sm text-[#2EC4C4]">{result.message}</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="setup-email"
                    className="block text-xs font-mono uppercase tracking-wider text-[#8580a0] mb-1"
                  >
                    Email
                  </label>
                  <div className="flex items-center gap-2">
                    <code
                      id="setup-email"
                      className="flex-1 text-sm font-mono text-[#f0eef8] bg-black/30 rounded-lg px-3 py-2 select-all"
                    >
                      {result.email}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopy(result.email ?? '')}
                      className="p-2 rounded-lg hover:bg-white/5 text-[#a09bb8] hover:text-[#f0eef8] transition-colors"
                      aria-label="Copy email"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="setup-password"
                    className="block text-xs font-mono uppercase tracking-wider text-[#8580a0] mb-1"
                  >
                    Password
                  </label>
                  <div className="flex items-center gap-2">
                    <code
                      id="setup-password"
                      className="flex-1 text-sm font-mono text-[#f0eef8] bg-black/30 rounded-lg px-3 py-2 select-all"
                    >
                      {result.password}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopy(result.password ?? '')}
                      className="p-2 rounded-lg hover:bg-white/5 text-[#a09bb8] hover:text-[#f0eef8] transition-colors"
                      aria-label="Copy password"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-[#2EC4C4]" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-[#F2A93B]/20 bg-[#F2A93B]/5 p-3">
                <p className="text-xs text-[#F2A93B] font-mono">
                  Save these credentials now. The password will not be shown again.
                </p>
              </div>

              <button
                type="button"
                onClick={goToSignIn}
                className="w-full py-3 rounded-xl bg-[#f2a93b] text-[#03020a] font-[Syne] text-sm font-semibold hover:bg-[#ffc15e] transition-colors"
              >
                Continue to Sign In
              </button>
            </div>
          ) : result?.error ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                <p className="text-sm text-red-400">{result.error}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  handleSeed();
                }}
                className="w-full py-2 rounded-lg bg-white/5 text-sm text-[#f0eef8] hover:bg-white/10 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-[#a09bb8]">
                No admin account detected. Create one now to access the dashboard. Credentials are
                configured via <code className="text-[#f0eef8]">ENGRAM_ADMIN_EMAIL</code> and{' '}
                <code className="text-[#f0eef8]">ENGRAM_ADMIN_PASSWORD</code> environment variables.
              </p>
              <button
                type="button"
                onClick={handleSeed}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#f2a93b] px-4 py-3 font-[Syne] text-sm font-semibold text-[#03020a] shadow-lg shadow-amber-500/20 transition-all hover:bg-[#ffc15e] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                {loading ? 'Creating admin...' : 'Create Admin Account'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center font-mono text-xs text-[#5c5878]">
          <a href="/sign-in" className="transition-colors hover:text-[#8580a0]">
            Already have an account? Sign in
          </a>
        </p>
      </motion.div>
    </div>
  );
}
