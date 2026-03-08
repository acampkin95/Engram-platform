/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    // ─── CONTAINER ───
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '2rem',
        lg: '4rem',
        xl: '5rem',
        '2xl': '6rem',
      },
    },

    extend: {
      // ─── RESPONSIVE BREAKPOINTS ───
      screens: {
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },

      // ─── KEYFRAMES ───
      keyframes: {
        'slide-in': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'toast-in': {
          '0%': { transform: 'translateX(1rem) scale(0.97)', opacity: '0' },
          '100%': { transform: 'translateX(0) scale(1)', opacity: '1' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(180,255,60,0.4)' },
          '50%': { opacity: '0.7', boxShadow: '0 0 0 6px rgba(180,255,60,0)' },
        },
        'glitch': {
          '0%, 90%, 100%': { clipPath: 'none', transform: 'none' },
          '92%': { clipPath: 'polygon(0 0, 100% 0, 100% 30%, 0 30%)', transform: 'translate(-2px, -2px)' },
          '94%': { clipPath: 'polygon(0 60%, 100% 60%, 100% 100%, 0 100%)', transform: 'translate(2px, 2px)' },
          '96%': { clipPath: 'none', transform: 'none' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.3s ease-out',
        'toast-in': 'toast-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
        'pulse-glow': 'pulse-glow 2s infinite',
        'glitch': 'glitch 8s infinite',
        'scan-line': 'scan-line 8s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },

      // ─── FONTS ───
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
        body: ['DM Sans', 'sans-serif'],
        // Alias for convenience
        sans: ['DM Sans', 'sans-serif'],
      },

      // ─── COLORS ───
      colors: {
        // Core Palette (Backgrounds)
        void: '#04040a',
        abyss: '#070710',
        surface: '#0d0d1a',
        raised: '#141428',
        border: '#1e1e3a',
        'border-hi': '#2a2a50',

        // Brand Primaries
        cyan: '#50ffff',
        'cyan-dim': '#09b5a5',
        plasma: '#0fbbaa',

        // Extended Palette
        acid: '#b4ff3c',
        volt: '#d4ff00',
        fuchsia: '#f380f5',
        ghost: '#7b7bff',
        ice: '#c8f7ff',
        'neon-r': '#ff2d6b',

        // Text Colors
        text: '#e0e2f0',
        'text-dim': '#7a7a9a',
        'text-mute': '#3a3a5a',

        // Semantic Aliases (for Tailwind utilities)
        brand: {
          DEFAULT: '#50ffff',
          cyan: '#50ffff',
          'cyan-dim': '#09b5a5',
          plasma: '#0fbbaa',
          acid: '#b4ff3c',
          volt: '#d4ff00',
          fuchsia: '#f380f5',
          ghost: '#7b7bff',
          ice: '#c8f7ff',
          'neon-r': '#ff2d6b',
        },

        dark: {
          void: '#04040a',
          abyss: '#070710',
          surface: '#0d0d1a',
          raised: '#141428',
          border: '#1e1e3a',
          'border-hi': '#2a2a50',
          // Legacy aliases
          900: '#04040a',
          800: '#070710',
          700: '#0d0d1a',
        },

        // Semantic status colors
        success: '#0fbbaa',
        warning: '#d4ff00',
        error: '#ff2d6b',
        info: '#50ffff',
      },

      // ─── TYPE SCALE ───
      fontSize: {
        // Hero
        'hero': ['64px', { lineHeight: '1', letterSpacing: '-0.04em', fontWeight: '800' }],
        // Display
        'display': ['40px', { lineHeight: '1', letterSpacing: '-0.03em', fontWeight: '800' }],
        // Heading
        'heading': ['28px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        // Title
        'title': ['20px', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
        // Body
        'body': ['15px', { lineHeight: '1.7', fontWeight: '400' }],
        // Small
        'small': ['12px', { lineHeight: '1.5' }],
        // Mono
        'mono': ['13px', { lineHeight: '1.6', letterSpacing: '0.05em' }],
        // Micro
        'micro': ['10px', { lineHeight: '1.4', letterSpacing: '0.25em' }],
      },

      // ─── SPACING ───
      spacing: {
        '4.5': '1.125rem',
        '13': '3.25rem',
        '15': '3.75rem',
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
        '30': '7.5rem',
      },

      // ─── BOX SHADOW ───
      boxShadow: {
        'glow-cyan': '0 0 24px rgba(80,255,255,0.3)',
        'glow-acid': '0 0 24px rgba(180,255,60,0.3)',
        'glow-volt': '0 0 24px rgba(212,255,0,0.3)',
        'glow-fuchsia': '0 0 24px rgba(243,128,245,0.3)',
        'glow-ghost': '0 0 24px rgba(123,123,255,0.3)',
        'glow-error': '0 0 24px rgba(255,45,107,0.3)',
        'glow-cyan-lg': '0 0 40px rgba(80,255,255,0.4), 0 0 80px rgba(80,255,255,0.15)',
        'glow-acid-lg': '0 0 40px rgba(180,255,60,0.4), 0 0 80px rgba(180,255,60,0.15)',
        'glow-fuchsia-lg': '0 0 40px rgba(243,128,245,0.4), 0 0 80px rgba(243,128,245,0.15)',
        'glow-plasma': '0 0 24px rgba(15,187,170,0.35)',
        'glow-plasma-lg': '0 0 40px rgba(15,187,170,0.4), 0 0 80px rgba(15,187,170,0.15)',
      },

      // ─── BORDER RADIUS ───
      borderRadius: {
        'none': '0',
      },

      // ─── BACKDROP BLUR ───
      backdropBlur: {
        'xs': '2px',
      },

      // ─── Z-INDEX ───
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
    },
  },
  plugins: [],
};
