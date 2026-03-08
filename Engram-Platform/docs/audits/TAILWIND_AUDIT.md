# Engram-Platform Frontend — Tailwind CSS v4 Audit

**Date**: March 2, 2026
**Scope**: Engram-Platform/frontend/
**Framework**: Next.js 15 + React 19 + Tailwind CSS v4 (CSS-native)

---

## 1. Configuration Overview

### Tailwind Setup
- **Version**: Tailwind CSS v4.0.0 (CSS-native, no config file)
- **PostCSS**: `@tailwindcss/postcss` v4.0.0
- **Config Location**: `app/globals.css` (CSS @theme directive)
- **PostCSS Config**: `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/postcss.config.mjs`

### PostCSS Configuration
```javascript
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

### CSS Architecture
- **Main CSS File**: `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/app/globals.css` (404 lines)
- **Design Tokens**: `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/design-system/tokens.css` (103 lines)
- **Total CSS**: ~507 lines of custom CSS

---

## 2. Design Tokens & Color System

### Primary Color Palette (Hardcoded in globals.css @theme)

#### Core Depth Palette
```css
--color-void: #03020a;           /* Deep background */
--color-deep: #090818;           /* Secondary background */
--color-layer-0: #0c0b1c;        /* Layer 0 */
--color-layer-1: #120f2b;        /* Layer 1 */
--color-layer-2: #1a1638;        /* Layer 2 */
--color-layer-3: #221d45;        /* Layer 3 */
--color-layer-4: #2c2658;        /* Layer 4 */
--color-panel: #0d0b1a;          /* Panel background */
```

#### Brand Colors
```css
--color-amber: #f2a93b;          /* Primary (Intelligence) */
--color-amber-bright: #ffc15e;   /* Bright variant */
--color-amber-dim: #b87b20;      /* Dim variant */

--color-violet: #7c5cbf;         /* Accent (Crawler) */
--color-violet-bright: #9b7de0;  /* Bright variant */
--color-violet-dim: #503980;     /* Dim variant */

--color-teal: #2ec4c4;           /* Memory tier */
--color-rose: #e05c7f;           /* Secondary accent */
```

#### Text Colors
```css
--color-text-primary: #f0eef8;   /* Main text */
--color-text-secondary: #a09bb8; /* Secondary text */
--color-text-muted: #5c5878;     /* Muted text */
```

#### Memory Tier Colors
```css
--color-memory-tier1: #f2a93b;   /* Tier 1 (Amber) */
--color-memory-tier2: #9b7de0;   /* Tier 2 (Violet) */
--color-memory-tier3: #2ec4c4;   /* Tier 3 (Teal) */
```

#### Semantic Colors
```css
--color-success: #2EC4C4;        /* Success (Teal) */
--color-warning: #F2A93B;        /* Warning (Amber) */
--color-error: #FF6B6B;          /* Error (Red) */
--color-info: #9B7DE0;           /* Info (Violet) */
```

### ShadCN/UI Bridge Tokens
The design system bridges ShadCN/UI tokens to Engram colors:
- `--color-primary`: #f2a93b (Amber)
- `--color-accent`: #9b7de0 (Violet)
- `--color-background`: #03020a (Void)
- `--color-foreground`: #f0eef8 (Light purple)
- `--color-destructive`: #ff6b6b (Red)

### Typography Tokens
```css
--font-sans: var(--font-instrument-serif), ui-serif, Georgia, serif;
--font-mono: var(--font-ibm-plex-mono), ui-monospace, monospace;
--font-display: var(--font-syne), ui-sans-serif, system-ui, sans-serif;
```

**Fonts Loaded** (via Next.js Google Fonts):
- **Syne** (400, 500, 600, 700) — Display font
- **IBM Plex Mono** (400, 500, 600) — Monospace
- **Instrument Serif** (400, italic) — Serif

### Spacing Tokens (in tokens.css)
```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
```

### Border Radius Tokens
```css
--radius-sm: 0.375rem;   /* 6px */
--radius-md: 0.5rem;     /* 8px */
--radius-lg: 0.75rem;    /* 12px */
--radius-xl: 1rem;       /* 16px */
--radius-full: 9999px;   /* Pill */
```

### Shadow Tokens
```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.5);
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.6);
--shadow-amber: 0 0 20px rgba(242, 169, 59, 0.15);
--shadow-purple: 0 0 20px rgba(155, 125, 224, 0.15);
--shadow-teal: 0 0 20px rgba(46, 196, 196, 0.15);
```

### Z-Index Tokens
```css
--z-sidebar: 40;
--z-header: 50;
--z-modal: 100;
--z-toast: 200;
```

---

## 3. Custom Utilities & @apply Patterns

### Animation Keyframes (9 total)
1. **strataShift** — Vertical translate + opacity pulse (4s)
2. **synapseFlare** — Scale + opacity pulse (2.5s)
3. **layerPulse** — Box-shadow glow pulse (amber, 2s)
4. **shimmer** — Background position shift (1.6s)
5. **fadeIn** — Opacity + translate Y (0.25s)
6. **pulse-glow-amber** — Amber glow pulse (2s)
7. **node-pulse** — Node glow with inset shadow (3s)
8. **traffic-flow** — Horizontal translate flow (4s)
9. **pageEnter** — Page transition (0.3s)
10. **staggerFade** — Stagger list animation (0.25s)
11. **gentleLift** — Hover lift effect (0.15s)

### Utility Classes (13 total)
```css
.skeleton              /* Shimmer loading animation */
.glow-amber           /* Amber box-shadow glow */
.glow-violet          /* Violet box-shadow glow */
.animate-fade-in      /* Fade in animation */
.animate-pulse-glow   /* Amber pulse glow */
.animate-node-pulse   /* Node pulse animation */
.animate-traffic      /* Traffic flow animation */
.animate-synapse      /* Synapse flare animation */
.animate-strata       /* Strata shift animation */
.glass                /* Glassmorphism base */
.hover-lift           /* Hover lift effect */
.hover-glow-amber     /* Hover amber glow */
.press-effect         /* Button press scale effect */
.focus-ring           /* Focus ring utility with @apply */
```

### Stagger Delay Classes (5 total)
```css
.stagger-1 { animation-delay: 0.05s; }
.stagger-2 { animation-delay: 0.1s; }
.stagger-3 { animation-delay: 0.15s; }
.stagger-4 { animation-delay: 0.2s; }
.stagger-5 { animation-delay: 0.25s; }
```

### Glassmorphism Base
```css
.glass {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(12px);
}
```

### Scrollbar Styling
```css
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(242, 169, 59, 0.15); }
::-webkit-scrollbar-thumb:hover { background: rgba(242, 169, 59, 0.3); }
```

### Selection Styling
```css
::selection {
  background: rgba(242, 169, 59, 0.2);
  color: #ffc15e;
}
```

### Reduced Motion Support
```css
@media (prefers-reduced-motion: reduce) {
  :root { --animations-enabled: 0; }
}

[data-animations="false"] *,
:has(#animations-disabled) * {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
}
```

---

## 4. Component Styling Patterns

### Design System Components Location
`/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/design-system/components/`

**21 Custom Components**:
- Badge.tsx (7 variants)
- Button.tsx (4 variants, CVA-based)
- Card.tsx (3 variants, CVA-based)
- DataTable.tsx
- EmptyState.tsx
- ErrorState.tsx
- Input.tsx
- LoadingState.tsx
- Modal.tsx
- NavItem.tsx
- SearchInput.tsx
- SectionHeader.tsx
- SidebarGroup.tsx
- Spinner.tsx
- StatCard.tsx
- StatusDot.tsx
- Tabs.tsx (3 variants)
- Tag.tsx
- Toast.tsx
- Tooltip.tsx
- EngramLogo.tsx

### Styling Approach: Class Variance Authority (CVA)
All design-system components use **CVA** for variant management:

**Example: Button Component**
```typescript
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-[#03020a] disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'bg-[#F2A93B]/10 border border-[#F2A93B]/20 text-[#F2A93B] hover:bg-[#F2A93B]/20 focus:ring-[#F2A93B]',
        secondary: 'bg-[#141428] border border-[#2a2a50] text-[#a09bb8] hover:border-[#F2A93B]/50 hover:text-[#f0eef8] focus:ring-[#F2A93B]/50',
        ghost: 'text-[#5c5878] hover:text-[#f0eef8] hover:bg-[#141428] focus:ring-[#2a2a50]',
        danger: 'bg-[#ff2d6b]/10 border border-[#ff2d6b]/20 text-[#ff2d6b] hover:bg-[#ff2d6b]/20 focus:ring-[#ff2d6b]',
        icon: 'bg-transparent text-[#5c5878] hover:text-[#f0eef8] hover:bg-[#141428] focus:ring-[#2a2a50]',
      },
      size: {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-5 py-2.5 text-base',
        icon: 'p-2',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);
```

### Hardcoded Hex Colors in Components (139 instances)

**Top Color Usage**:
- `#F2A93B` (Amber) — 38 instances
- `#2EC4C4` (Teal) — 30 instances
- `#1e1e3a` (Dark layer) — 30 instances
- `#5c5878` (Muted text) — 24 instances
- `#FF6B6B` (Error red) — 23 instances
- `#9B7DE0` (Violet) — 23 instances
- `#f0eef8` (Primary text) — 21 instances
- `#a09bb8` (Secondary text) — 14 instances
- `#0d0d1a` (Panel bg) — 8 instances
- `#ff2d6b` (Danger pink) — 5 instances
- `#E07D9B`, `#7D9BE0` (Gradient colors) — 5 instances each
- `#2a2a50` (Border) — 4 instances
- `#141428` (Elevated bg) — 4 instances
- `#03020a` (Void) — 1 instance

### Component Memoization
All design-system components use `memo()` and `forwardRef()` for performance optimization.

---

## 5. Dark Mode Implementation

### Strategy: Dark-Mode-First
- **Default Theme**: `dark` (via `next-themes`)
- **Theme Provider**: `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/components/ThemeProvider.tsx`
- **Attribute**: `class` (adds/removes `.dark` class on `<html>`)
- **System Detection**: Enabled (`enableSystem: true`)

### ThemeProvider Code
```typescript
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
```

### Viewport Configuration
```typescript
export const viewport: Viewport = {
  themeColor: '#F2A93B',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};
```

### CSS Variables in Root
All colors defined as CSS variables in `:root` — no light mode variants currently defined.

---

## 6. Optimization Opportunities

### 🔴 Critical Issues

1. **Hardcoded Hex Colors in Components**
   - **Issue**: 139 instances of hardcoded hex colors in CVA variants
   - **Impact**: Difficult to maintain, inconsistent with design tokens
   - **Recommendation**: Extract to CSS variables or Tailwind theme config
   - **Example**: `bg-[#F2A93B]/10` should be `bg-amber/10` with theme variable

2. **Duplicate Color Definitions**
   - **Issue**: Colors defined in both `globals.css` (@theme) and `tokens.css` (CSS variables)
   - **Impact**: Maintenance burden, potential inconsistencies
   - **Recommendation**: Consolidate to single source of truth

3. **No Tailwind Config File**
   - **Issue**: Using CSS-native @theme in globals.css instead of tailwind.config.ts
   - **Impact**: Harder to extend, no IDE autocomplete for custom colors
   - **Recommendation**: Create `tailwind.config.ts` with theme extension

### 🟡 Medium Priority

4. **Inline Hex Colors in @theme**
   - **Issue**: 50+ hardcoded hex values in globals.css @theme block
   - **Impact**: Not DRY, difficult to update brand colors globally
   - **Recommendation**: Define color palette as CSS variables first, then reference in @theme

5. **Missing Light Mode**
   - **Issue**: No light mode theme defined
   - **Impact**: Cannot support light mode without major refactor
   - **Recommendation**: Add light mode color variants to @theme

6. **Unused Animations**
   - **Issue**: 11 keyframe animations defined, unclear which are actively used
   - **Impact**: Unused CSS bloat
   **Recommendation**: Audit usage and remove unused animations

7. **Stagger Delay Classes**
   - **Issue**: 5 hardcoded stagger delay classes (.stagger-1 through .stagger-5)
   - **Impact**: Not scalable, limited to 5 items
   - **Recommendation**: Use Tailwind's animation-delay utilities or CSS variables

8. **CVA Variant Explosion**
   - **Issue**: Components have many hardcoded color variants
   - **Impact**: Large CSS output, difficult to maintain
   - **Recommendation**: Use CSS variables in CVA variants instead of hardcoded colors

### 🟢 Low Priority

9. **Scrollbar Styling**
   - **Issue**: Webkit-specific scrollbar styling not cross-browser compatible
   - **Impact**: Firefox users see default scrollbar
   - **Recommendation**: Consider using a scrollbar library or accept browser defaults

10. **Focus Ring Utility**
    - **Issue**: Uses @apply with hardcoded colors
    - **Impact**: Not composable with other focus utilities
    - **Recommendation**: Use Tailwind's focus utilities directly

11. **Glassmorphism Base**
    - **Issue**: Hardcoded backdrop-filter blur value
    - **Impact**: Cannot easily adjust blur amount
    - **Recommendation**: Add blur variants to Tailwind config

---

## 7. File Inventory

### Configuration Files
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/postcss.config.mjs` (5 lines)
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/app/globals.css` (404 lines)
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/design-system/tokens.css` (103 lines)

### Component Files (21 design-system components)
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/design-system/components/Badge.tsx`
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/design-system/components/Button.tsx`
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/design-system/components/Card.tsx`
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/design-system/components/DataTable.tsx`
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/design-system/components/EmptyState.tsx`
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/design-system/components/ErrorState.tsx`
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/design-system/components/Input.tsx`
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/design-system/components/LoadingState.tsx`
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/design-system/components/Modal.tsx`
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/design-system/components/NavItem.tsx`
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/design-system/components/SearchInput.tsx`
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/design-system/components/SectionHeader.tsx`
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/design-system/components/SidebarGroup.tsx`
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/design-system/components/Spinner.tsx`
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/design-system/components/StatCard.tsx`
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/design-system/components/StatusDot.tsx`
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/design-system/components/Tabs.tsx`
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/design-system/components/Tag.tsx`
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/design-system/components/Toast.tsx`
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/design-system/components/Tooltip.tsx`
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/design-system/EngramLogo.tsx`

### Theme Provider
- `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/components/ThemeProvider.tsx` (12 lines)

### ShadCN/UI Components (30+ components)
Located in `/Volumes/dev-1/DevProduction/Engram/Engram-Platform/frontend/src/components/ui/`

---

## 8. Metrics Summary

| Metric | Value |
|--------|-------|
| **Total CSS Lines** | ~507 |
| **Custom Animations** | 11 |
| **Utility Classes** | 13 |
| **Design System Components** | 21 |
| **Hardcoded Hex Colors** | 139 |
| **Unique Colors Used** | 15 |
| **CVA-Based Components** | 21 |
| **Memoized Components** | 21 |
| **CSS Variables Defined** | 50+ |
| **Tailwind Plugins** | 1 (@tailwindcss/postcss) |

---

## 9. Recommendations Priority Matrix

| Priority | Issue | Effort | Impact | Recommendation |
|----------|-------|--------|--------|-----------------|
| 🔴 Critical | Hardcoded hex colors | Medium | High | Extract to theme config |
| 🔴 Critical | Duplicate color definitions | Low | High | Consolidate to single source |
| 🔴 Critical | No Tailwind config file | Low | High | Create tailwind.config.ts |
| 🟡 Medium | Inline hex in @theme | Medium | Medium | Use CSS variables first |
| 🟡 Medium | No light mode | High | Medium | Add light mode variants |
| 🟡 Medium | Unused animations | Low | Low | Audit and remove |
| 🟡 Medium | Stagger delay classes | Low | Low | Use CSS variables |
| 🟡 Medium | CVA variant explosion | High | Medium | Refactor with CSS variables |
| 🟢 Low | Scrollbar styling | Low | Low | Accept browser defaults |
| 🟢 Low | Focus ring utility | Low | Low | Use Tailwind utilities |

---

## 10. Next Steps

1. **Phase 1 (Week 1)**: Create `tailwind.config.ts` with theme extension
2. **Phase 2 (Week 1-2)**: Consolidate color definitions and extract hardcoded hex values
3. **Phase 3 (Week 2)**: Refactor CVA components to use CSS variables
4. **Phase 4 (Week 3)**: Add light mode support
5. **Phase 5 (Week 3-4)**: Audit and optimize animations
6. **Phase 6 (Week 4)**: Performance testing and bundle size analysis

---

**Audit Completed**: March 2, 2026
**Auditor**: Claude Code
**Status**: Ready for optimization planning
