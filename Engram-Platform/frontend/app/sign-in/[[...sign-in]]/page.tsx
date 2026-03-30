import { SignIn } from '@clerk/nextjs';

const clerkAppearance = {
  variables: {
    colorBackground: '#0a0914',
    colorPrimary: '#f2a93b',
    colorText: '#f0eef8',
    colorInputBackground: 'rgba(255, 255, 255, 0.06)',
    colorInputText: '#f0eef8',
    borderRadius: '0.75rem',
    fontFamily: '"IBM Plex Mono", monospace',
  },
  elements: {
    rootBox: 'w-full max-w-md',
    card: 'bg-[#0a0914] border border-white/[0.06] shadow-2xl shadow-amber-500/5',
    headerTitle: 'font-[Syne] text-[#f0eef8]',
    headerSubtitle: 'text-[#a09bb8]',
    socialButtonsBlockButton:
      'border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-[#f0eef8] transition-all',
    socialButtonsBlockButtonText: 'text-[#f0eef8] font-medium',
    dividerLine: 'bg-white/[0.06]',
    dividerText: 'text-[#5c5878]',
    formFieldLabel: 'text-[#a09bb8] text-xs uppercase tracking-wider',
    formFieldInput:
      'bg-white/[0.04] border-white/[0.08] text-[#f0eef8] focus:border-[#f2a93b] focus:ring-[#f2a93b]/20',
    formButtonPrimary:
      'bg-[#f2a93b] hover:bg-[#ffc15e] text-[#03020a] font-semibold transition-all shadow-lg shadow-amber-500/20',
    footerActionLink: 'text-[#f2a93b] hover:text-[#ffc15e]',
    identityPreviewEditButton: 'text-[#f2a93b]',
    formFieldAction: 'text-[#f2a93b]',
    otpCodeFieldInput: 'border-white/[0.08] bg-white/[0.04] text-[#f0eef8]',
    alternativeMethodsBlockButton: 'border-white/[0.08] text-[#a09bb8] hover:bg-white/[0.04]',
  },
};

export default function SignInPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-void overflow-hidden">
      {/* Ambient glow effects */}
      <div className="absolute top-1/4 -left-32 h-96 w-96 rounded-full bg-[#f2a93b]/[0.03] blur-[128px]" />
      <div className="absolute bottom-1/4 -right-32 h-96 w-96 rounded-full bg-[#7C5CBF]/[0.04] blur-[128px]" />

      {/* Grid pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo & branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03] shadow-lg shadow-amber-500/10">
            <span className="font-[Syne] text-2xl font-bold text-[#f2a93b]">E</span>
          </div>
          <h1 className="font-[Syne] text-2xl font-bold tracking-tight text-[#f0eef8]">
            Welcome back
          </h1>
          <p className="mt-1 font-mono text-sm text-[#5c5878]">
            Sign in to your Engram workspace
          </p>
        </div>

        {/* Clerk sign-in widget */}
        <SignIn appearance={clerkAppearance} />

        {/* Footer */}
        <p className="mt-8 text-center font-mono text-xs text-[#3a3555]">
          Engram Intelligence Platform
        </p>
      </div>
    </div>
  );
}
