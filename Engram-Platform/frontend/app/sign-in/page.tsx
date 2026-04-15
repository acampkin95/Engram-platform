'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { authClient } from '@/src/lib/auth-client';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
type FormData = z.infer<typeof schema>;

// Animated floating orbs background
function AuthBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      {/* Deep void base */}
      <div className="absolute inset-0 bg-[#03020A]" />

      {/* Animated orbs */}
      <div
        className="absolute rounded-full"
        style={{
          width: '600px',
          height: '600px',
          top: '-10%',
          left: '-15%',
          background: 'radial-gradient(circle, rgba(124,92,191,0.08) 0%, transparent 70%)',
          animation: 'orb1 25s ease-in-out infinite',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: '500px',
          height: '500px',
          bottom: '-5%',
          right: '-10%',
          background: 'radial-gradient(circle, rgba(242,169,59,0.07) 0%, transparent 70%)',
          animation: 'orb2 30s ease-in-out infinite',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: '350px',
          height: '350px',
          top: '40%',
          right: '20%',
          background: 'radial-gradient(circle, rgba(124,92,191,0.05) 0%, transparent 70%)',
          animation: 'orb3 20s ease-in-out infinite',
          filter: 'blur(30px)',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: '250px',
          height: '250px',
          top: '20%',
          left: '30%',
          background: 'radial-gradient(circle, rgba(242,169,59,0.04) 0%, transparent 70%)',
          animation: 'orb4 35s ease-in-out infinite',
          filter: 'blur(30px)',
        }}
      />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.018]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      {/* Noise grain overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: '128px 128px',
        }}
      />
    </div>
  );
}

// Google logo SVG
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/dashboard';

  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setAuthError(null);
    const { error } = await authClient.signIn.email({
      email: data.email,
      password: data.password,
      callbackURL: redirect,
    });
    if (error) {
      setAuthError(error.message ?? 'Invalid credentials');
      return;
    }
    router.push(redirect);
    router.refresh();
  };

  const handleGoogle = async () => {
    setIsGoogleLoading(true);
    setAuthError(null);
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: redirect,
    });
    setIsGoogleLoading(false);
  };

  const isGoogleEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <AuthBackground />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md px-4"
      >
        {/* Logo */}
        <div className="mb-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] shadow-xl shadow-amber-500/10 backdrop-blur-sm"
          >
            <span className="font-[Syne] text-2xl font-bold text-[#f2a93b]">E</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <h1 className="font-[Syne] text-2xl font-bold tracking-tight text-[#f0eef8]">
              Welcome back
            </h1>
            <p className="mt-1 font-mono text-sm text-[#8580a0]">
              Sign in to your Engram workspace
            </p>
          </motion.div>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-8 shadow-2xl shadow-black/40 backdrop-blur-xl"
        >
          {/* Error */}
          {authError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 font-mono text-sm text-red-400"
            >
              {authError}
            </motion.div>
          )}

          {/* Email/password form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-[#8580a0]"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 font-mono text-sm text-[#f0eef8] placeholder-[#5c5878] outline-none ring-0 transition-all focus:border-[#f2a93b]/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-[#f2a93b]/10"
                placeholder="you@example.com"
                aria-invalid={errors.email ? 'true' : undefined}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
              {errors.email && (
                <p id="email-error" className="mt-1 font-mono text-xs text-red-400">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-[#8580a0]"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...register('password')}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 pr-11 font-mono text-sm text-[#f0eef8] placeholder-[#5c5878] outline-none ring-0 transition-all focus:border-[#f2a93b]/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-[#f2a93b]/10"
                  placeholder="••••••••"
                  aria-invalid={errors.password ? 'true' : undefined}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8580a0] transition-colors hover:text-[#f0eef8]"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="mt-1 font-mono text-xs text-red-400">
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#f2a93b] px-4 py-3 font-[Syne] text-sm font-semibold text-[#03020a] shadow-lg shadow-amber-500/20 transition-all hover:bg-[#ffc15e] hover:shadow-amber-500/30 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2a93b]/60"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Google SSO */}
          {isGoogleEnabled && (
            <>
              <div className="my-6 flex items-center gap-3" aria-hidden="true">
                <div className="h-px flex-1 bg-white/[0.06]" />
                <span className="font-mono text-xs text-[#5c5878]">or continue with</span>
                <div className="h-px flex-1 bg-white/[0.06]" />
              </div>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={isGoogleLoading}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 font-[DM_Sans] text-sm font-medium text-[#f0eef8] transition-all hover:bg-white/[0.06] hover:border-white/[0.14] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              >
                {isGoogleLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <GoogleIcon className="h-4 w-4 flex-shrink-0" />
                )}
                Continue with Google
              </button>
            </>
          )}
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="mt-6 text-center font-mono text-xs text-[#5c5878]"
        >
          <a
            href="https://memory.velocitydigi.com"
            className="transition-colors hover:text-[#8580a0]"
          >
            &larr; Back to Engram
          </a>
          <span className="mx-3 text-white/[0.08]">&middot;</span>
          <a href="/setup" className="transition-colors hover:text-[#F2A93B]">
            First time? Set up admin
          </a>
          <span className="mx-3 text-white/[0.08]">&middot;</span>
          Engram Intelligence Platform
        </motion.p>
      </motion.div>

      {/* CSS keyframe animations for orbs */}
      <style>{`
        @keyframes orb1 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          25% { transform: translate(40px, -30px) scale(1.05); }
          50% { transform: translate(20px, 20px) scale(0.97); }
          75% { transform: translate(-20px, 10px) scale(1.03); }
        }
        @keyframes orb2 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(-30px, 20px) scale(1.04); }
          66% { transform: translate(25px, -15px) scale(0.96); }
        }
        @keyframes orb3 {
          0%, 100% { transform: translate(0px, 0px); }
          50% { transform: translate(-20px, -30px); }
        }
        @keyframes orb4 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          40% { transform: translate(30px, 20px) scale(1.06); }
          80% { transform: translate(-15px, -10px) scale(0.94); }
        }
      `}</style>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}
