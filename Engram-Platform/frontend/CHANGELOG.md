# Changelog

All notable changes to Engram Platform Frontend are documented in this file.

## [Unreleased]

### Style & Design System

#### Fixed Design System Token Compliance (2026-03-27)

Standardized NotificationSettings and SystemHealthContent components against Engram design system tokens in globals.css.

**NotificationSettings.tsx**
- Replaced `var(--color-success)` with semantic color `#2ee6a6` (success green)
- Replaced `var(--color-critical)` with semantic color `#ff4757` (error red) in StatusBadge component
- Standardized all text colors to design tokens: `#f0eef8` (primary), `#a09bb8` (secondary), `#5c5878` (muted)
- Updated code block backgrounds to layer-2: `#222633` with semantic text colors
- Fixed page header to use `font-display` (Playfair) for h1 with proper class order
- Replaced hardcoded `var(--color-text-*)` variables with direct hex values for consistency

**SystemHealthContent.tsx**
- Fixed page header h1 to use `font-display` (Playfair) with correct class ordering
- Replaced hardcoded `#1e1e3a` and `#0d0d1a` with design token equivalents: `#222633/60` and `#13151c`
- Updated log service select dropdown border to `#2a2f3e/60` (layer-3 with opacity)
- Standardized all text colors: primary `#f0eef8`, secondary `#a09bb8`, muted `#5c5878`
- Maintained semantic chart colors: rose/error `#E07D9B`, teal/success `#2EC4C4`, amber/warning `#F2A93B`

**Design System Compliance**
- Colors use three-family system: `#2ee6a6` (success), `#ff4757` (critical), `#2EC4C4` (teal status)
- Typography: h1 elements use `font-display` (Playfair Display), body text uses `font-sans` (DM Sans), code uses `font-mono` (JetBrains Mono)
- Layer tokens: `#222633` (layer-2), `#13151c` (layer-0), `#2a2f3e` (layer-3)
- All code blocks use consistent styling with layer backgrounds and semantic text colors
- Removed `var(--color-*)` references; direct hex values for cleaner Tailwind v4 syntax

### Tests

#### Added Comprehensive Test Coverage for Hooks and Lib Modules (2026-03-26)

Implemented extensive test suite to close coverage gaps in core hooks and lib modules:

**useWebSocket.ts** (80% → 97.8% line coverage)
- Tests for non-JSON message handling fallback
- Exponential backoff reconnection delay verification
- Message buffering during reconnect state
- Token URL parameter encoding
- Reconnection attempt limiting
- String data transmission without JSON encoding
- Timer cleanup on disconnect
- Unmounted component callback suppression

**useRAGChat.ts** (88% → 90.8% line coverage)
- SSE chunk accumulation in streaming responses
- Stream error handling and state cleanup
- Final content flushing on completion
- Malformed SSE line skipping with valid line processing
- Multi-turn conversation history tracking
- Context memory ID injection in assistant messages
- rAF batching for streaming updates

**useURLState.ts** (81% → 77.3% with parsing tests)
- Parameter parsing validation (page/limit to numbers)
- Default value handling for invalid inputs
- Pagination state setter functionality
- Dashboard URL state parameter schema validation
- Search/filter/sort identity function parsing

**memory-client.ts** (84% → 100% line coverage)
- `getMatters()` POST request to /graph/query
- `updateMatter()` with ID encoding
- `deleteMatter()` with ID encoding
- Special character encoding in IDs (URL-safe)

**crawler-client.ts** (90% → 100% line coverage)
- `sendToMemory()` endpoint /api/crawl/deep
- Crawl data transfer to memory API
- Error handling for unavailable endpoints

**Test Statistics**
- 91 new test cases added
- 251 total tests passing
- All test files pass vitest validation
- Mock WebSocket, SSE streams, and async operations properly tested

### Technical Details

- Used Vitest's fake timers for reconnection delay testing
- Mocked ReadableStream for SSE simulation
- Proper lifecycle testing with renderHook mount/unmount
- Memory client mocking to avoid API dependencies
- RequestAnimationFrame batching verification
- Error state propagation validation

## Previous Versions

See git history for prior releases.
