<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# components

## Purpose

React components for UI and feature implementation. Contains both low-level components (form inputs, buttons) and high-level feature components (CommandPalette, DraggableGrid). Includes UI primitives from `ui/` (Radix + shadcn pattern) and custom components.

## Key Files

| File | Description |
|------|-------------|
| `Animations.tsx` | Animation utilities (stagger, fade, scale) |
| `BrandPalette.tsx` | Brand color palette display component |
| `CommandPalette.tsx` | Command/search palette (cmdk) |
| `DraggableGrid.tsx` | Draggable grid layout (react-grid-layout) |
| `ErrorBoundary.tsx` | React error boundary |
| `FilterBar.tsx` | Data filtering UI |
| `FocusTrap.tsx` | Focus trap for modals |
| `LiveRegion.tsx` | Accessibility live region |
| `OnboardingTour.tsx` | User onboarding tour |
| `OptimizedImage.tsx` | Next.js Image wrapper (optimized) |
| `PreferencesManager.tsx` | User preferences UI |
| `Skeletons.tsx` | Loading skeleton variants |
| `ThemeProvider.tsx` | Theme context provider |
| `ThemeToggle.tsx` | Dark/light mode toggle |
| `WidgetToolbar.tsx` | Widget configuration toolbar |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `__tests__/` | Unit tests (vitest) |
| `ui/` | Radix UI primitives (badge, button, dialog, etc.) |
| `forms/` | Form components (FormInput, etc.) |
| `animations/` | Animation definitions and utilities |

## For AI Agents

### Working In This Directory

1. **Creating Components**
   - Create folder with `ComponentName.tsx`
   - Export types alongside component
   - Add `__tests__/ComponentName.test.tsx`
   - Use 'use client' directive for interactive components

2. **UI Primitives**
   - Located in `ui/` subdirectory
   - Radix UI + shadcn pattern
   - Base styling + CVA variants
   - Props interface exported

3. **Testing**
   - Unit tests in `__tests__/` (matching filename)
   - Use @testing-library/react
   - Mock Clerk, theme, providers in setup

4. **Styling**
   - Tailwind CSS v4 (CSS-native)
   - CVA for component variants
   - Dark mode: supports dark: prefix

### Testing Requirements

- **All Components:** 80% statements minimum
- **Interactive:** Test user interactions (click, type, etc.)
- **Accessibility:** Test ARIA attributes (jest-axe)
- **MSW:** Mock API responses for data-dependent components

### Common Patterns

1. **Component with Props Type**
   ```tsx
   // src/components/MyComponent.tsx
   'use client';
   import { ReactNode } from 'react';

   export interface MyComponentProps {
     label: string;
     children: ReactNode;
   }

   export function MyComponent({ label, children }: MyComponentProps) {
     return <div>{label}{children}</div>;
   }
   ```

2. **Component with Test**
   ```tsx
   // src/components/__tests__/MyComponent.test.tsx
   import { render, screen } from '@testing-library/react';
   import { MyComponent } from '../MyComponent';

   test('renders label', () => {
     render(<MyComponent label="Test">Content</MyComponent>);
     expect(screen.getByText('Test')).toBeInTheDocument();
   });
   ```

3. **UI Primitive with CVA**
   ```tsx
   // src/components/ui/button.tsx
   import { cva } from 'class-variance-authority';
   import { clsx } from 'clsx';

   const buttonVariants = cva('px-4 py-2 rounded', {
     variants: {
       variant: {
         primary: 'bg-amber-500 text-white',
         secondary: 'bg-gray-200 text-black',
       },
     },
   });

   export function Button({ variant = 'primary', ...props }) {
     return (
       <button className={buttonVariants({ variant })} {...props} />
     );
   }
   ```

4. **Animation Component**
   ```tsx
   // src/components/animations/FadeIn.tsx
   import { motion } from 'framer-motion';

   export function FadeIn({ children }) {
     return (
       <motion.div
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
       >
         {children}
       </motion.div>
     );
   }
   ```

## Directory Structure

```
components/
├── __tests__/              # Unit tests
│   ├── Animations.test.tsx
│   ├── BrandPalette.test.tsx
│   └── ...
├── ui/                     # Radix UI primitives (30+ components)
│   ├── badge.tsx
│   ├── button.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── input.tsx
│   ├── tooltip.tsx
│   └── ...
├── forms/                  # Form components
│   └── FormInput.tsx (+ test)
├── animations/             # Animation utilities
│   ├── index.ts
│   ├── PageTransition.tsx
│   └── stagger.ts
├── Animations.tsx          # Animation definition component
├── BrandPalette.tsx        # Brand palette display
├── CommandPalette.tsx      # Command/search palette
├── DraggableGrid.tsx       # Draggable grid
├── ErrorBoundary.tsx       # Error boundary
├── FilterBar.tsx           # Filter UI
├── FocusTrap.tsx           # Focus management
├── LiveRegion.tsx          # Accessibility live region
├── OnboardingTour.tsx      # Onboarding tour
├── OptimizedImage.tsx      # Optimized image
├── PreferencesManager.tsx  # Preferences UI
├── Skeletons.tsx           # Skeleton variants
├── ThemeProvider.tsx       # Theme provider
├── ThemeToggle.tsx         # Theme toggle
└── WidgetToolbar.tsx       # Widget toolbar
```

## UI Primitives (ui/)

30+ components using Radix UI + shadcn pattern:
- Badge, Button, Calendar, Checkbox, Dialog, Dropdown Menu
- Input, Label, Popover, Radio Group, Scroll Area, Select
- Separator, Slider, Switch, Tabs, Toggle, Tooltip, etc.

## Key Components

| Component | Purpose | Interactive |
|-----------|---------|-------------|
| CommandPalette | Command/search (⌘K) | Yes |
| DraggableGrid | Draggable widget grid | Yes |
| FilterBar | Data filtering UI | Yes |
| OnboardingTour | User onboarding | Yes |
| ErrorBoundary | Error catching | No |
| Skeletons | Loading indicators | No |
| OptimizedImage | Image optimization | No |
| ThemeToggle | Dark/light mode | Yes |

## Dependencies

- react (Components, hooks)
- framer-motion (Animations)
- @radix-ui/* (UI primitives)
- class-variance-authority (Variants)
- clsx (Class merging)
- cmdk (Command palette)
- react-grid-layout (Draggable grid)
- next/image (Optimized images)

## Code Style

- Single quotes (')
- 100 char width
- 2-space indent
- 'use client' for interactive components
- Export types with components

## Known Patterns

1. **Composition Over Props:** Use slot pattern
   ```tsx
   <Card>
     <CardHeader>Title</CardHeader>
     <CardContent>Body</CardContent>
   </Card>
   ```

2. **Variants with CVA:** Type-safe component variants
   ```tsx
   const variants = cva('base', {
     variants: {
       size: { sm: '...', md: '...', lg: '...' },
       color: { red: '...', blue: '...' },
     },
   });
   ```

3. **Dark Mode:** Tailwind dark: prefix
   ```tsx
   <div className="bg-white dark:bg-gray-900">
     Responds to theme
   </div>
   ```

4. **Accessibility:** ARIA attributes
   ```tsx
   <div role="button" aria-label="Close" aria-pressed={open}>
     ...
   </div>
   ```

<!-- MANUAL: Add component-specific patterns as they emerge -->
