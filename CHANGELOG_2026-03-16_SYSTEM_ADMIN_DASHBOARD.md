# Changelog - Unified System Admin Dashboard

Date: 2026-03-16

## Completed

- Added a new admin health route at `Engram-Platform/frontend/app/dashboard/system/health/page.tsx`
- Built a unified dashboard with:
  - health summary cards
  - service status table
  - current resource metrics table
  - 7-day incident/maintenance charts
  - maintenance action controls
  - per-service and full-system controls
  - Resend-backed test notification trigger
  - live SSE log viewer
- Added server-side admin orchestration in `Engram-Platform/frontend/src/server/system-admin.ts`
- Added shared server-side admin access control in `Engram-Platform/frontend/src/server/admin-access.ts`
- Added thin Platform API routes under `Engram-Platform/frontend/app/api/system/*`
- Wired the new route into sidebar navigation and page title handling

## Hardening And UX Polish

- Added admin-only gating for `/dashboard/system/*` and `/api/system/*`
- Supported admin access via allowlist, Clerk metadata role, or Clerk org admin/owner role
- Added live log severity filters, search, and per-service tabs
- Added subtle motion using existing fade/stagger animation helpers for a more live operational feel
- Preserved a lean bundle footprint while expanding the dashboard interaction model

## Verification

- Platform production build passes
- System dashboard component test passes
- Server orchestration test passes in Node environment
- Admin access tests pass in Node environment
- Dashboard shell/nav test passes

## Notes

- Server admin tests must be run with `--environment node`
- The implementation reuses existing Memory/Crawler/MCP health and maintenance surfaces rather than duplicating backend logic
