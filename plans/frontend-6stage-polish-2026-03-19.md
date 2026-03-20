# Frontend 6-Stage Polish Plan

**Created:** 2026-03-19
**Scope:** Engram-Platform/frontend (Next.js 15 + React 19)
**Goal:** Production-quality polish, then QA + PR + commit

---

## Stage 1 — Lint & Format (AUTO-FIXABLE)
- [ ] Run `biome check --fix` to auto-fix 11 errors
- [ ] Fix remaining format issues (line-width wrapping in system-admin.ts, memories content)
- [ ] Verify zero biome errors

## Stage 2 — Type Safety
- [ ] Replace `any` in `src/components/__tests__/OptimizedImage.test.tsx` with proper types
- [ ] Replace `any` casts in `src/hooks/useForceLayout.ts` with proper generics
- [ ] Audit for other `any` usage across codebase
- [ ] Verify `tsc --noEmit` passes cleanly

## Stage 3 — Code Quality
- [ ] Replace hardcoded hex colors in DashboardClient.tsx with CSS custom properties / Tailwind tokens
- [ ] Replace hardcoded hex colors in dashboard layout.tsx
- [ ] Audit and remove stray `console.log` / `console.error` (keep only error boundaries)
- [ ] Fix admin nav section: uses `section="intelligence"` instead of `section="admin"`
- [ ] Fix missing timeline title in `getPageTitle()` function
- [ ] Remove dead files: `add_decay_button.js`, `add_decay_to_client.js` at frontend root

## Stage 4 — Accessibility
- [ ] Add skip-to-content link in dashboard layout
- [ ] Add `aria-current="page"` to active nav items
- [ ] Ensure all interactive elements have visible focus indicators
- [ ] Add `role="navigation"` and `aria-label` to sidebar nav
- [ ] Add `role="banner"` to header
- [ ] Add `role="main"` to main content area
- [ ] Check color contrast ratios for muted text (#5c5878 on #03020a)

## Stage 5 — UX Polish
- [ ] Add system/health loading.tsx and error.tsx (missing)
- [ ] Verify all routes have loading.tsx coverage
- [ ] Check empty states on all data views
- [ ] Verify responsive behavior on mobile (sidebar collapse)

## Stage 6 — Admin Frontend
- [ ] Polish SystemHealthContent — review chart styling consistency
- [ ] Add system layout loading/error boundaries
- [ ] Ensure admin section has distinct visual identity in sidebar
- [ ] Add admin-specific header badge/indicator

## QA
- [ ] `npx biome check .` — zero errors
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run test:run` — all pass
- [ ] `npm run build` — clean build
- [ ] Manual route smoke test

## PR & Commit
- [ ] Write changelog
- [ ] Create descriptive commit
- [ ] Review diff
