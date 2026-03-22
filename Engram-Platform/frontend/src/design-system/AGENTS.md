<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# design-system

## Purpose

Centralized design system components (42 tested components). Implements the Engram brand palette, typography, and consistent UI patterns using Tailwind CSS v4, CVA for variants, and Radix UI for accessible primitives. Serves as the single source of truth for visual consistency.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Barrel export (all components) |
| `EngramLogo.tsx` | Engram brand logo |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `components/` | 42 design system components |
| `__tests__/` | Component tests (vitest) |

## Design System Components (42)

| Component | Purpose | Type |
|-----------|---------|------|
| Badge | Tag/label | Display |
| Button | CTA button | Interactive |
| Card | Content container | Layout |
| DataTable | Data display | Data |
| EmptyState | No data placeholder | Feedback |
| ErrorState | Error display | Feedback |
| Input | Text input | Form |
| LoadingState | Loading indicator | Feedback |
| Modal | Dialog/popup | Layout |
| NavItem | Navigation link | Navigation |
| SearchInput | Search box | Form |
| SectionHeader | Section title | Display |
| SidebarGroup | Sidebar grouping | Navigation |
| Spinner | Loading spinner | Feedback |
| StatCard | Statistic display | Display |
| StatusDot | Status indicator | Display |
| Tabs | Tab navigation | Navigation |
| Tag | Metadata tag | Display |
| Toast | Notification | Feedback |
| Tooltip | Contextual help | Display |
| + 22 more | — | — |

## For AI Agents

### Working In This Directory

1. **Adding Components**
   - Create in `components/ComponentName.tsx`
   - Export from `components/index.ts`
   - Add test in `__tests__/ComponentName.test.tsx`
   - Document props interface

2. **Component Structure**
   - Accept props (theme, variant, size)
   - Use CVA for variants
   - Support dark mode (dark: prefix)
   - Export types alongside component

3. **Testing**
   - Unit tests for all components
   - Accessibility (jest-axe)
   - Visual regression (optional)
   - Props validation

### Testing Requirements

- **All 42 Components:** 80% coverage minimum
- **Accessibility:** jest-axe for WCAG compliance
- **Props:** Test variant combinations
- **States:** Test disabled, loading, error, etc.

### Common Patterns

1. **Design System Component**
   ```tsx
   // src/design-system/components/Button.tsx
   import { cva } from 'class-variance-authority';
   import { clsx } from 'clsx';

   const buttonVariants = cva(
     'inline-flex items-center justify-center rounded font-medium',
     {
       variants: {
         variant: {
           primary: 'bg-amber-500 text-white hover:bg-amber-600',
           secondary: 'bg-gray-200 text-black hover:bg-gray-300',
           ghost: 'hover:bg-gray-100 dark:hover:bg-gray-800',
         },
         size: {
           sm: 'px-3 py-1 text-sm',
           md: 'px-4 py-2 text-base',
           lg: 'px-6 py-3 text-lg',
         },
         disabled: {
           true: 'opacity-50 cursor-not-allowed',
         },
       },
       compoundVariants: [
         {
           variant: 'primary',
           disabled: true,
           className: 'bg-amber-300 text-amber-900',
         },
       ],
       defaultVariants: {
         variant: 'primary',
         size: 'md',
       },
     },
   );

   export interface ButtonProps
     extends React.ButtonHTMLAttributes<HTMLButtonElement> {
     variant?: 'primary' | 'secondary' | 'ghost';
     size?: 'sm' | 'md' | 'lg';
     disabled?: boolean;
   }

   export function Button({
     variant = 'primary',
     size = 'md',
     className,
     ...props
   }: ButtonProps) {
     return (
       <button
         className={clsx(
           buttonVariants({ variant, size, disabled: props.disabled }),
           className,
         )}
         {...props}
       />
     );
   }
   ```

2. **Component Test**
   ```tsx
   // src/design-system/__tests__/Button.test.tsx
   import { render, screen } from '@testing-library/react';
   import { axe, toHaveNoViolations } from 'jest-axe';
   import { Button } from '../components/Button';

   expect.extend(toHaveNoViolations);

   test('renders button with label', () => {
     render(<Button>Click me</Button>);
     expect(screen.getByRole('button')).toHaveTextContent('Click me');
   });

   test('applies variant classes', () => {
     render(<Button variant="secondary">Button</Button>);
     expect(screen.getByRole('button')).toHaveClass('bg-gray-200');
   });

   test('is accessible', async () => {
     const { container } = render(<Button>Click me</Button>);
     const results = await axe(container);
     expect(results).toHaveNoViolations();
   });
   ```

3. **Component with Slots**
   ```tsx
   // src/design-system/components/Card.tsx
   export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

   export function Card({ className, ...props }: CardProps) {
     return (
       <div
         className={clsx(
           'rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4',
           className,
         )}
         {...props}
       />
     );
   }

   export function CardHeader({ className, ...props }: CardProps) {
     return <div className={clsx('mb-4 pb-2 border-b', className)} {...props} />;
   }

   export function CardContent({ className, ...props }: CardProps) {
     return <div className={clsx('space-y-4', className)} {...props} />;
   }

   export function CardFooter({ className, ...props }: CardProps) {
     return <div className={clsx('mt-4 pt-2 border-t', className)} {...props} />;
   }
   ```

## Brand Palette

**Colors:**
- Primary: Amber (#F2A93B)
- Accent: Violet (#7C5CBF)
- Background: Deep Void (#03020A)
- Neutral: Gray (200, 400, 600, 800)
- Semantic: Red (error), Green (success), Yellow (warning), Blue (info)

**Typography:**
- Display: Syne (brand)
- Monospace: IBM Plex Mono (code)
- Serif: Instrument Serif (accents)
- System: -apple-system, BlinkMacSystemFont

## Component Categories

**Feedback Components:**
- EmptyState, ErrorState, LoadingState, Spinner, Toast, Tooltip

**Form Components:**
- Input, SearchInput, Button (submit), Select, Checkbox, Radio

**Data Components:**
- DataTable, StatCard, Badge, Tag

**Layout Components:**
- Card, Modal, SidebarGroup, Tabs

**Navigation Components:**
- NavItem, Tabs, SidebarGroup

**Display Components:**
- StatusDot, Badge, Tag, Spinner, EngramLogo

## Dependencies

- react (Components)
- class-variance-authority (Variants)
- clsx (Class merging)
- @radix-ui/* (Accessible primitives)
- tailwindcss (Styling)
- framer-motion (Animations, optional)

## Code Style

- Single quotes (')
- 100 char width
- 2-space indent
- 'use client' for interactive components
- Export types with components

## Testing Pattern

**42 Component Tests:**
- All components have unit tests
- Accessibility via jest-axe
- Props and variants tested
- Dark mode support verified

## Known Patterns

1. **Slot Composition:** Semantic components
   ```tsx
   <Card>
     <CardHeader>Title</CardHeader>
     <CardContent>Body</CardContent>
     <CardFooter>Footer</CardFooter>
   </Card>
   ```

2. **Variants with CVA:** Type-safe styling
   ```tsx
   const buttonVariants = cva('base', {
     variants: {
       variant: { primary: '...', secondary: '...' },
       size: { sm: '...', md: '...', lg: '...' },
     },
   });
   ```

3. **Dark Mode Support:**
   ```tsx
   className="bg-white dark:bg-gray-950 text-black dark:text-white"
   ```

4. **Accessibility Compliance:**
   - ARIA attributes (role, aria-label, aria-disabled)
   - Semantic HTML (button, input, nav, etc.)
   - Keyboard navigation
   - Color contrast

<!-- MANUAL: Add component-specific patterns as they emerge -->
