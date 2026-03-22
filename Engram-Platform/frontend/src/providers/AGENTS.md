<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# providers

## Purpose

React context providers and wrapper components. Initializes global features like theme management, motion animations, URL state, and client-side setup. Mounted once at app layout level and provide functionality to all child components.

## Key Files

| File | Description |
|------|-------------|
| `Providers.tsx` | Main provider wrapper (Clerk, SWR, Sonner, Themes) |
| `MotionProvider.tsx` | Framer Motion AnimatePresence wrapper |
| `URLStateProvider.tsx` | URL state management (nuqs) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `__tests__/` | Provider unit tests (vitest) |

## For AI Agents

### Working In This Directory

1. **Creating Providers**
   - Wrap child components with context
   - Initialize features (theme, auth, etc.)
   - Mount only in layout (once per page)
   - Export as client component ('use client')

2. **Provider Order**
   - Clerk (auth) first
   - Sentry (error tracking) second
   - SWR (data fetching) third
   - Theme (styling) fourth
   - Motion (animations) fifth
   - URL State (routing) last

3. **Testing**
   - Mock Clerk, SWR, theme
   - Test provider effects
   - Verify child component access

### Testing Requirements

- **Providers.tsx:** Test initialization, Clerk integration
- **MotionProvider:** Test AnimatePresence wrapping
- **URLStateProvider:** Test URL param sync

### Common Patterns

1. **Main Provider Wrapper (Providers.tsx)**
   ```tsx
   // src/providers/Providers.tsx
   'use client';
   import { ClerkProvider } from '@clerk/nextjs';
   import { SWRConfig } from 'swr';
   import { Toaster } from 'sonner';
   import { ThemeProvider } from 'next-themes';
   import { MotionProvider } from './MotionProvider';

   export function Providers({ children }: { children: React.ReactNode }) {
     return (
       <ClerkProvider>
         <SWRConfig value={{ dedupingInterval: 60000 }}>
           <ThemeProvider attribute="class" defaultTheme="dark">
             <MotionProvider>{children}</MotionProvider>
             <Toaster />
           </ThemeProvider>
         </SWRConfig>
       </ClerkProvider>
     );
   }
   ```

2. **Motion Provider**
   ```tsx
   // src/providers/MotionProvider.tsx
   'use client';
   import { AnimatePresence } from 'framer-motion';

   export function MotionProvider({ children }: { children: React.ReactNode }) {
     return <AnimatePresence mode="wait">{children}</AnimatePresence>;
   }
   ```

3. **URL State Provider**
   ```tsx
   // src/providers/URLStateProvider.tsx
   'use client';
   import { NuqsAdapter } from 'nuqs/app';

   export function URLStateProvider({
     children,
   }: {
     children: React.ReactNode;
   }) {
     return <NuqsAdapter>{children}</NuqsAdapter>;
   }
   ```

4. **Root Layout Integration**
   ```tsx
   // app/layout.tsx
   import { Providers } from '@/providers/Providers';

   export default function RootLayout({
     children,
   }: {
     children: React.ReactNode;
   }) {
     return (
       <html lang="en">
         <head>
           <link rel="stylesheet" href="/global-styles.css" />
         </head>
         <body>
           <Providers>{children}</Providers>
         </body>
       </html>
     );
   }
   ```

## Providers Included

| Provider | Purpose | Features |
|----------|---------|----------|
| ClerkProvider | Authentication | Auth session, useUser() hook |
| SWRConfig | Data fetching | Caching, deduplication, revalidation |
| ThemeProvider | Theming | Dark/light mode toggle |
| MotionProvider | Animations | Framer Motion AnimatePresence |
| Toaster | Notifications | Toast messages (sonner) |
| URLStateProvider | URL state | Query param sync (nuqs) |

## Provider Order (Important)

**Correct nesting order:**
1. ClerkProvider (outermost)
2. SWRConfig
3. ThemeProvider
4. MotionProvider
5. Toaster (no wrapping needed)
6. URLStateProvider
7. {children}

**Why the order matters:**
- Clerk must initialize auth first
- SWR needs to be available to all components
- Theme must be set before rendering
- Motion wraps for page transitions
- URL state syncs last

## Dependencies

- @clerk/nextjs (Auth)
- swr (Data fetching)
- sonner (Toasts)
- next-themes (Theme switching)
- framer-motion (Animations)
- nuqs (URL state)

## Code Style

- Single quotes (')
- 100 char width
- 2-space indent
- 'use client' directive required
- Export as named function

## Testing Pattern

```tsx
// src/providers/__tests__/Providers.test.tsx
import { render, screen } from '@testing-library/react';
import { Providers } from '../Providers';

test('renders children', () => {
  render(
    <Providers>
      <div>Test Content</div>
    </Providers>,
  );
  expect(screen.getByText('Test Content')).toBeInTheDocument();
});
```

## Known Patterns

1. **SWR Global Configuration:**
   ```tsx
   <SWRConfig
     value={{
       dedupingInterval: 60000,
       revalidateOnFocus: false,
       errorRetryCount: 3,
     }}
   >
     {children}
   </SWRConfig>
   ```

2. **Theme Integration:**
   ```tsx
   // Access theme in component
   import { useTheme } from 'next-themes';

   const { theme, setTheme } = useTheme();
   ```

3. **Clerk Setup:**
   ```tsx
   // Access user in component
   import { useUser } from '@clerk/nextjs';

   const { user, isSignedIn } = useUser();
   ```

4. **Motion Setup:**
   ```tsx
   // Animate page transitions
   import { motion } from 'framer-motion';

   <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
     Page content
   </motion.div>
   ```

<!-- MANUAL: Add provider-specific patterns as they emerge -->
