# Changelog — Engram Landing

All notable changes to the Engram marketing site are documented here.

---

## [Unreleased]

### Design Polish — Getting Started Wizard (2026-03-28)

**Enhanced the Getting Started page with production-grade visual design and interaction polish.**

#### Components Created/Modified
- `app/getting-started/page.tsx` — Complete rewrite with advanced design system integration

#### Design System Implementation
- **Stepper Visual Polish**
  - Active steps: amber background with subtle glow shadow
  - Completed steps: teal background with SVG checkmark (not emoji)
  - Future steps: surface-2 background with muted text
  - Circle size: w-10 h-10 for proper touch targets
  - Connecting lines: teal gradient for completed, amber pulse for active, muted for future

- **Progress Bar**
  - Full-width bar with surface-1 background
  - Amber gradient fill with smooth 500ms transitions
  - Glow shadow effect on progress edge
  - Shows percentage + "Step X of 6" label

- **Step Content Polish**
  - Titles: display font (Syne), bold, text-2xl
  - Descriptions: body font (Instrument Serif), secondary text color, 1.7 line-height
  - Code blocks: new `CodeBlock` component with:
    - Dark background (layer-2), rounded-xl, 3px left border
    - Line numbers (muted, right-aligned)
    - Copy button: positioned top-right, transitions to "Copied!" with teal
    - Language/filename label in header
    - Syntax highlighting for bash, json, python
    - Mono font (IBM Plex Mono), good padding (p-5)

- **Custom List Markers**
  - Colored dots (amber, teal, rose) matching section theme
  - Smooth hover transitions
  - Proper spacing (space-y-3) between items

- **Navigation Buttons**
  - Previous: secondary style with left arrow, disabled on step 1 (opacity-50)
  - Next: primary amber with right arrow
  - Last step: shows "Complete!" message with localhost:3002 link
  - Full width on mobile, stacked vertically
  - Smooth transitions between steps

#### Interactive Features
- **Keyboard Navigation**: Arrow keys to navigate steps
- **Smooth Scroll**: Auto-scrolls to top when changing steps
- **Entrance Animations**: Step content fades in with fade-in animation
- **Mobile Responsive**:
  - Stepper hidden on mobile (full-width progress bar at top)
  - Code blocks with horizontal scroll for long lines
  - Buttons: full width, stacked vertically
  - Proper padding (px-4 on mobile)

#### Responsive Design
- Tested at mobile, tablet, and desktop breakpoints
- Touch-target friendly (w-10 h-10 circles for stepper)
- Proper keyboard accessibility (arrow key navigation)

#### Accessibility
- ARIA labels for stepper buttons
- Proper semantic HTML
- High contrast text on backgrounds
- Keyboard-navigable stepper

#### Bug Fixes
- Fixed `Icon` component style prop issue in `app/platform/[product]/page.tsx`
- Fixed invalid CSS `marginX` property in `app/components/PlatformArchitecture.tsx`

#### Build Verification
- TypeScript compilation: ✓ Passed
- Build output: ✓ Production build successful
- Dev server: ✓ Running without errors
- No console warnings related to Getting Started page

---

## Notes for Future Sessions

- Stepper styling uses CSS variables from design system (--engram-amber, --engram-teal, etc.)
- CodeBlock component is reusable across other pages
- Mobile stepper is hidden; consider extracting progress bar to separate component for reuse
- All animations use Tailwind's `duration-*` utilities; no external animation library needed
- Keyboard navigation is always enabled; no need to toggle

---

## [2026-03-28] - Landing Page Polish Sprint

### Visual Hierarchy
- Consistent major section spacing: `py-32 md:py-40` (5 sections)
- Added subtle gradient dividers between sections: `bg-gradient-to-r from-transparent via-[color]/30 to-transparent`
- Product pillar cards maintain equal visual weight with consistent heights
- Gradient overlays at section boundaries for depth

### Responsive Design
- Mobile-first layout: `px-4 sm:px-6 lg:px-8` (6 sections)
- Grid breakpoints: 1-col mobile (`grid-cols-1`), 2-col tablet (`md:grid-cols-2`), proper desktop
- Proper padding on all screen sizes: 4px mobile, 6px small, 8px large
- Footer grid collapses properly: 1-col → 2-col tablet → 4-col desktop

### Card Layout Improvements
- Product feature cards: `group` class added for group-hover effects
- Stats grid: glassmorphic backgrounds with `backdrop-filter: blur(8px)` and subtle glow on hover
- Integration grid items: colored border glow on hover matching the item's color (6 different colors)
- Use case cards: color variety rotation (violet → amber → teal → rose → amber → violet)

### Micro-interactions
- Card hover lift: `hover:-translate-y-1` (stats) and `hover:-translate-y-2` (integrations)
- Icon scale on hover: `group-hover:scale-110`, `group-hover:scale-125`, `group-hover:scale-150`
- Bullet point scale effect on performance metrics: `group-hover:scale-150`
- Footer links: subtle underline-on-hover using expanding border-bottom (`group-hover:w-full`)
- CTA code block: glassmorphic border with subtle glow effect
- Scroll indicator: animated chevron at bottom of CTA (`animate-bounce`)
- All interactive elements: `transition-all duration-300`

### Content Structure
- Docker compose code snippet properly styled in CTA section with amber glowing border
- Scroll indicator hint added below CTA with animated chevron animation
- PlatformArchitecture import working correctly

### Technical Implementation
- All changes confined to `app/page.tsx` — no other files modified
- Preserved all existing imports and component usage
- Maintained overall section structure with enhanced visual quality
- TypeScript build: successful ✓
- Production build: successful ✓
- Dev server test: renders without errors ✓

### Design Philosophy
- Intentional, not generic: every detail has purpose
- Color-coded integration cards prevent visual fatigue through variety
- Glassmorphism used strategically (stats grid, code block)
- Motion is high-impact: hover states and scroll indicators
- Responsive hierarchy maintained across all breakpoints
