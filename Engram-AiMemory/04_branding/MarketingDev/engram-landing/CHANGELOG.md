# Changelog - Engram Landing Page

## [Unreleased]

### Enhanced - Hero Component (`Hero.tsx`)

**Animations & Interactions:**
- Staggered service card entrance animations (150ms intervals)
- Service card hover effects: scale(1.03), brighter borders, elevated shadow
- Tech stack information revealed on hover with smooth fade-in
- Active service indicator: pulsing amber dot with glow animation
- Parallax scroll effect on strata lines (varying depth at 0.015-0.03 scale)
- Third ambient orb added (teal, bottom-right) with enhanced motion
- Reduced scan line opacity for subtlety

**Text Animations:**
- Word-by-word staggered animation for "Memory. Intelligence. Integration." subtitle
- Staggered fade-in-up for meta badges (version, services, status, license)
- CTA buttons with hover glow effects and smooth transitions

**Scroll Indicator:**
- Animated bouncing chevron with "Explore" label (amber, mono font)
- Auto-fades out as user scrolls past 50px
- Uses prefers-reduced-motion for accessibility

**Interactive States:**
- Connecting vertical dashed line that brightens on hover
- Service card borders glow with color-matched shadows on hover
- Icon scaling (synapseFlare) animation on card interaction
- 300ms cubic-bezier easing for all transitions

**Accessibility:**
- Respects `prefers-reduced-motion` media query
- ARIA labels on service cards
- GPU-accelerated transforms/opacity (no layout thrashing)

---

### Enhanced - PlatformArchitecture Component (`PlatformArchitecture.tsx`)

**Architecture Blocks:**
- Glassmorphic effect with shimmer animation on hover
- Block scaling (1.02) with brighter borders and enhanced shadows
- Port numbers as mono-styled badges in card corners
- Role descriptions visible on hover (Memory layer, Web intelligence, AI bridge, etc.)

**Visual Design:**
- Color-coded legend with dot indicators (Amber, Violet, Teal, Rose)
- Service blocks animate in staggered (0.2s + index * 0.08s)
- Infrastructure layer blocks with reduced opacity (0.95) for visual hierarchy
- Connection divider with pulsing "↓ Orchestrated ↓" label

**Tech Stack Display:**
- Individual tech tags with delayed animation on hover (30ms stagger)
- Tags brighten and lift (translateY -2px) on card hover
- Semantic color-matching with service brand colors

**Responsive Design:**
- Desktop: Full 2x2 grid layout
- Tablet/Mobile: Stackable with semantic grouping
- Legend placed at top with color indicators
- Graceful degradation for reduced-motion preferences

**Accessibility:**
- Full keyboard navigation with focus rings
- Respects `prefers-reduced-motion` media query
- Semantic HTML structure with proper role attributes
- Smooth transitions (300ms cubic-bezier) for all interactive states

**Code Quality:**
- Removed unused `DataFlowParticles` component
- Fixed ESLint issues (setState in effects, unused imports)
- Proper TypeScript typing with React.CSSProperties for inline styles
- Separated effect handlers for media query changes

---

## Implementation Details

### Animation Easing
- Main transitions: `cubic-bezier(0.23, 1, 0.320, 1)` (snappy, premium feel)
- Fade/entrance: `ease` (standard acceleration/deceleration)
- Pulsing effects: `ease-in-out` for organic ambient motion

### Color System
- Brand amber: `var(--engram-amber)` (#F2A93B)
- Brand violet: `var(--engram-violet)` (#7C5CBF)
- Brand teal: `var(--engram-teal)` (#2EC4C4)
- Brand rose: `var(--engram-rose)` (#E05C7F)
- Dynamic opacity: 0.3-1 based on interaction state

### Performance
- GPU-accelerated: transform, opacity only
- No forced reflows (no width/height animation)
- Scroll listener debounced via requestAnimationFrame (implicit in React)
- Parallax depth: 0.015-0.03 scale factor (subtle, performant)

### Verified
- Build: ✓ TypeScript compilation
- Lint: ✓ ESLint clean (Hero + PlatformArchitecture)
- Accessibility: ✓ prefers-reduced-motion respected
- Responsive: ✓ Grid-based, scales with viewport

