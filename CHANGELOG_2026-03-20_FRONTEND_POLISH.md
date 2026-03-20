# Changelog: Frontend 6-Stage Polish

**Date:** 2026-03-20
**Scope:** Engram-Platform/frontend
**QA Status:** 0 Biome errors | 0 TypeScript errors | 318/320 tests pass | Build clean

---

## Stage 1 — Lint & Format
- Fixed 11+ Biome violations (string concatenation -> template literals, import ordering, formatting)
- Added `.omc` to Biome ignore list (internal OMC state files)
- All 265 source files now pass `biome check` with zero errors

## Stage 2 — Type Safety (29 TypeScript errors -> 0)
- Eliminated all `any` types in `useForceLayout.ts` with proper D3 SimNode generics
- Replaced `any` in `OptimizedImage.test.tsx` mock with typed `React.ImgHTMLAttributes`
- Fixed `react-resizable-panels` import (default -> named exports: `Group`, `Panel`, `Separator`)
- Fixed `carousel.tsx` ref type (`HTMLDivElement` -> `HTMLFieldSetElement`)
- Fixed `FormInput.tsx` generic constraints with `DefaultValues<T>` typing
- Fixed `useRAGChat.ts` `memory_id` mapping with nullish coalescing
- Fixed 15+ `string | undefined` -> `string` mismatches across memory views with null guards
- Fixed `unknown` -> `ReactNode` errors with `String()` casts in analytics/memories
- Fixed missing `setIsRelViewerOpen` variable in `MemoryGraphContent.tsx`
- Fixed `memory-client.ts` `createMemory` signature to accept `AddMemoryRequest`
- Fixed `MemoryGraphContent.test.tsx` store mock type compatibility

## Stage 3 — Code Quality
- **BUG FIX:** Admin nav items used `section="intelligence"` instead of `section="admin"` — now routes correctly
- **BUG FIX:** Missing "Timeline" in `getPageTitle()` function — header now shows correct title
- Replaced 12+ hardcoded hex colors with CSS custom property tokens (`--color-void`, `--color-deep`, `--color-amber`, `--color-text-muted`, `--color-text-primary`)
- Tokenized NavItem colors (was `#9B7DE0` -> `var(--color-violet-bright)`, etc.)
- Removed dead files: `add_decay_button.js`, `add_decay_to_client.js`, `fix_perf.js`, orphan `1` file

## Stage 4 — Accessibility
- Added skip-to-content link (visible on keyboard focus, styled with amber accent)
- Added `aria-label="Main navigation"` to sidebar nav element
- Added `aria-current="page"` to active NavItem links
- Added `id="main-content"` to main content area for skip-link target

## Stage 5 — UX Polish
- Added `loading.tsx` for `/dashboard/memory/timeline` (was missing)
- Added `loading.tsx` for `/dashboard/system/health` (was missing)
- Added `error.tsx` for `/dashboard/system/health` (was missing)
- All 20 dashboard routes now have loading state coverage

## Stage 6 — Admin Frontend
- Added `admin` as new SystemSection type in NavItem (was only `crawler | memory | intelligence`)
- Admin section now has distinct rose color (`--color-rose: #e05c7f`) for visual identity
- Added `loading.tsx` and `error.tsx` for `/dashboard/system` route group
- Admin access control (`requireAdminAccess()`) already enforced in system layout

---

## Files Changed
- **Modified:** 39 files
- **Created:** 5 files (loading/error boundaries)
- **Deleted:** 4 files (dead scripts)
- **Net:** +123 lines / -511 lines (net reduction of ~388 lines)

## Verification
- `biome check .` — 0 errors (265 files)
- `tsc --noEmit` — 0 errors
- `vitest run` — 318/320 tests pass (2 pre-existing OOM in graph test)
- `next build` — clean, all routes compile
