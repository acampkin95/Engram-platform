# Engram Tactical OSINT Interface — Design System

**Version:** 1.0.0
**Created:** 2026-03-23
**Status:** Design Specification

---

## 1. Design Philosophy

### Core Principles

| Principle | Description |
|-----------|-------------|
| **Tactical, not corporate** | Feels like Palantir + trading terminal + cyber intel console |
| **Analytical, not AI-assistanty** | Data-dense, operator-focused, minimal chrome |
| **Modular, not cluttered** | Composable workspace, user-controlled density |
| **Built for operators** | Keyboard-first, power-user shortcuts, dense information |

### Anti-Patterns (AVOID)

- ❌ Rounded pastel SaaS cards
- ❌ Generic AI chat layouts
- ❌ "Notion clone" aesthetics
- ❌ Overuse of gradients + glass blur
- ❌ Emojis as UI icons
- ❌ Scale transforms that shift layout on hover
- ❌ Light pastel colors
- ❌ Large whitespace padding

---

## 2. Color System

### Base Palette (Dark-First)

```css
/* Core depth layers — TRUE BLACK foundation */
--color-void: #0A0B10;        /* Primary background */
--color-deep: #0F1117;        /* Secondary background */
--color-layer-0: #13151C;     /* Tertiary background */
--color-layer-1: #1A1D28;     /* Elevated surfaces */
--color-layer-2: #222633;     /* Cards/panels */
--color-layer-3: #2A2F3E;     /* Hover states */
--color-layer-4: #343A4D;     /* Active states */
```

### Functional Color Channels

Colors are **functional**, not decorative. Each color has semantic meaning:

| Channel | Hex | Usage |
|---------|-----|-------|
| **Intelligence** | `#00D4FF` (Cyan) | Data nodes, intelligence signals, processed information |
| **Anomaly/Threat** | `#FFB020` (Amber) | Warnings, anomalies, flagged items, risk indicators |
| **Active Process** | `#7C5CFF` (Violet) | Running crawls, active agents, in-progress operations |
| **Success/Online** | `#2EE6A6` (Green) | Healthy services, completed tasks, verified data |
| **Critical/Error** | `#FF4757` (Red) | Errors, critical issues, failed operations |
| **Neutral/Context** | `#6B7280` (Gray) | Metadata, secondary text, timestamps |

### Text Colors

```css
--color-text-primary: #F0EEF8;    /* Primary text */
--color-text-secondary: #A09BB8;  /* Secondary text */
--color-text-muted: #5C5878;      /* Muted/disabled text */
--color-text-inverse: #0A0B10;    /* Text on accent backgrounds */
```

### Border & Surface

```css
--color-border: rgba(255, 255, 255, 0.06);    /* Subtle borders */
--color-border-strong: rgba(255, 255, 255, 0.12);  /* Emphasized borders */
--color-border-focus: var(--color-intelligence);    /* Focus rings */
```

### Status Indicators

```typescript
type StatusColor = 
  | 'intelligence'  // Cyan - data flowing
  | 'anomaly'       // Amber - needs attention
  | 'active'        // Violet - in progress
  | 'success'       // Green - complete/healthy
  | 'critical'      // Red - error/failure
  | 'neutral';      // Gray - idle/pending
```

---

## 3. Typography

### Font Stack

```css
/* Primary: Technical, readable */
--font-sans: 'Inter', 'IBM Plex Sans', system-ui, sans-serif;

/* Monospace: Code, IDs, timestamps */
--font-mono: 'JetBrains Mono', 'IBM Plex Mono', monospace;

/* Display: Headings (optional) */
--font-display: 'Syne', 'Space Grotesk', sans-serif;
```

### Type Scale

```css
--text-xs: 0.75rem;     /* 12px - Labels, metadata */
--text-sm: 0.875rem;    /* 14px - Secondary text */
--text-base: 1rem;      /* 16px - Body text */
--text-lg: 1.125rem;    /* 18px - Emphasis */
--text-xl: 1.25rem;     /* 20px - Section headers */
--text-2xl: 1.5rem;     /* 24px - Page titles */
--text-3xl: 2rem;       /* 32px - Major headings */
```

### Line Height & Spacing

- Body text: `line-height: 1.6`
- Headings: `line-height: 1.2`
- Letter spacing: Normal for body, `-0.025em` for headings

---

## 4. Layout System

### Three-Column Structure

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER (64px) - Status bar, global controls               │
├────────┬────────────────────────────────────┬───────────────┤
│        │                                    │               │
│  LEFT  │         CENTER WORKSPACE           │    RIGHT      │
│  64px  │         (flexible)                 │    320px      │
│ COLLAP │                                    │   (collapses) │
│ SIBLE  │   ┌──────────────────────────┐    │               │
│        │   │   PANEL GRID (snap)      │    │   CONTEXT     │
│  ICON  │   │   ┌────┐ ┌────┐ ┌────┐  │    │   PANEL       │
│  NAV   │   │   │    │ │    │ │    │  │    │               │
│        │   │   └────┘ └────┘ └────┘  │    │   Entity       │
│        │   │   ┌────┐ ┌────┐ ┌────┐  │    │   Inspector    │
│        │   │   │    │ │    │ │    │  │    │               │
│        │   │   └────┘ └────┘ └────┘  │    │   Details      │
│        │   └──────────────────────────┘    │               │
│ 64px   │                                    │   Related     │
│ expand │                                    │   Items       │
├────────┴────────────────────────────────────┴───────────────┤
│  FOOTER (32px) - Status line, connection status            │
└─────────────────────────────────────────────────────────────┘
```

### Sidebar (Icon-First, Collapsible)

**Collapsed State (64px):**
- Icon-only navigation
- Active section highlighted with functional color
- Hover reveals label tooltip

**Expanded State (240px):**
- Icon + label navigation
- Section grouping with dividers
- Nested navigation for sub-sections

### Panel Grid System

- 12-column grid with 8px gutters
- Panels snap to grid
- Minimum panel size: 2 columns (240px)
- Drag handles on panel headers
- Resize handles on panel edges

---

## 5. Core Components

### 5.1 Entity Relationship Graph

**Purpose:** Primary visualization for OSINT data relationships

**Features:**
- Force-directed layout with physics simulation
- Zoom: Mouse wheel, pinch
- Pan: Click + drag on empty space
- Node selection: Click
- Multi-select: Shift + click, or drag rectangle
- Node expansion: Double-click to expand connections
- Edge highlighting: Hover shows relationship type

**Node Types:**

```typescript
type EntityType = 
  | 'person'      // Cyan
  | 'organization' // Violet
  | 'location'    // Green
  | 'document'    // Amber
  | 'event'       // Rose
  | 'artifact'    // Gray
  | 'unknown';    // Muted
```

**Edge Types:**

```typescript
type RelationshipType =
  | 'associated'   // Solid, subtle
  | 'communicated' // Dashed, cyan
  | 'located_at'   // Dotted, green
  | 'owns'         // Solid, amber
  | 'member_of'    // Solid, violet
  | 'referenced';  // Dashed, gray
```

**Implementation:**
```tsx
// Use @xyflow/react with custom nodes
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';

// Custom node with entity type styling
function EntityNode({ data }: { data: EntityNodeData }) {
  const colorScheme = entityColorMap[data.type];
  return (
    <div className={cn(
      'rounded-sm border px-3 py-2 min-w-[120px]',
      'bg-[var(--color-layer-1)]',
      'transition-all duration-150',
      data.selected && 'ring-2 ring-[var(--color-intelligence)]'
    )} style={{ borderColor: colorScheme.border }}>
      <div className="text-xs font-mono text-[var(--color-text-muted)]">
        {data.type.toUpperCase()}
      </div>
      <div className="text-sm font-medium truncate">
        {data.label}
      </div>
    </div>
  );
}
```

### 5.2 Crawl Stream Feed

**Purpose:** Real-time ingestion visualization

**Features:**
- Live scrollable feed (newest at top)
- Auto-pause on hover
- Filter by: source, type, risk level
- Click to inspect entity
- Status indicators (success/anomaly/active)

**Stream Item:**

```tsx
interface StreamItem {
  id: string;
  timestamp: Date;
  source: 'crawler' | 'osint' | 'api' | 'agent';
  type: EntityType;
  status: StatusColor;
  title: string;
  summary: string;
  metadata: Record<string, string>;
}
```

**Visual Design:**
- Compact row format (48px height)
- Left: Status dot (color by status)
- Center: Title + summary (truncate)
- Right: Timestamp + source badge
- Hover: Full expansion, action buttons

### 5.3 Timeline Intelligence View

**Purpose:** Chronological event correlation

**Features:**
- Horizontal or vertical timeline
- Event clustering by time window
- Anomaly highlights (amber markers)
- Zoom levels: day, week, month, year
- Click event to select entity
- Drag to select time range

**Event Marker:**

```tsx
interface TimelineEvent {
  id: string;
  timestamp: Date;
  type: EntityType;
  severity: 'normal' | 'anomaly' | 'critical';
  title: string;
  relatedEntities: string[];
}
```

**Visual Design:**
- Vertical line with markers
- Normal: Subtle dot (gray)
- Anomaly: Amber ring with pulse
- Critical: Red ring with pulse
- Clusters show count badge
- Selected: Cyan highlight

### 5.4 Entity Inspector Panel

**Purpose:** Detailed view of selected entity

**Sections:**
1. **Header:** Type badge, primary label, status
2. **Metadata:** Key-value pairs, timestamps, sources
3. **Relationships:** Connected entities (clickable)
4. **Memory:** Related vector memory entries
5. **Source Trace:** Provenance chain (where data came from)
6. **Actions:** Export, flag, investigate, delete

**Visual Design:**
- Fixed width panel (320px)
- Collapsible sections
- Sticky header on scroll
- Loading skeleton while fetching

### 5.5 Agent Execution Console

**Purpose:** Monitor autonomous agent operations

**NOT a chat interface.** Agents are processes, not conversational.

**Features:**
- Task queue (pending, running, completed, failed)
- Execution logs (streaming)
- Decision trace (why agent made choices)
- Manual override controls
- Resource usage metrics

**Task Item:**

```tsx
interface AgentTask {
  id: string;
  agent: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  progress: number; // 0-100
  startedAt?: Date;
  completedAt?: Date;
  logs: LogEntry[];
  decisions: DecisionTrace[];
}
```

**Visual Design:**
- List view with status indicators
- Expandable rows for logs
- Progress bar for running tasks
- Color-coded status dots
- Action buttons: pause, resume, cancel

### 5.6 Intelligence Layers Toggle

**Purpose:** Switch between data interpretation levels

**Layers:**
1. **Raw Data** - Unprocessed crawler output
2. **Processed Intelligence** - Entity-extracted, deduplicated
3. **Agent Interpretation** - AI-analyzed insights

**Visual Design:**
- Segmented control (3 segments)
- Active segment highlighted with functional color
- Smooth transition between layers
- Layer indicator badge on affected panels

### 5.7 Investigation Mode

**Purpose:** Lock UI into focused analysis state

**Activation:** Button in header or keyboard shortcut (Cmd/Ctrl+I)

**Features:**
- Full-screen graph view
- Pinned entities panel
- Timeline correlation view
- Notes panel
- Export investigation bundle

**Visual Design:**
- Overlay mode (escapes normal layout)
- Darker background (#050507)
- Pinned entities sidebar
- Floating timeline at bottom
- Notes panel as modal

### 5.8 Memory Depth Slider

**Purpose:** Control historical context depth

**Range:** 1 hour → 1 year

**Visual Design:**
- Slider with discrete stops
- Labels: 1h, 6h, 24h, 7d, 30d, 90d, 1y
- Value display shows current range
- Affects all time-based visualizations

---

## 6. Interaction Patterns

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + B` | Toggle sidebar |
| `Cmd/Ctrl + K` | Command palette |
| `Cmd/Ctrl + I` | Investigation mode |
| `Cmd/Ctrl + F` | Global search |
| `Cmd/Ctrl + /` | Keyboard shortcuts help |
| `Esc` | Exit mode / deselect |
| `Space` | Pause/resume streams |
| `?` | Contextual help |

### Microinteractions

| Element | Behavior |
|---------|----------|
| Node hover | Highlight connected edges, dim others |
| New data | Subtle pulse (not popup) |
| Background process | Progress indicator in footer |
| Loading | Skeleton screens, not spinners |
| Error | Toast notification, inline marker |
| Selection | Cyan ring, panel updates |

### Cursor States

| Element | Cursor |
|---------|--------|
| Clickable | `pointer` |
| Draggable | `grab` / `grabbing` |
| Resizable | `col-resize` / `row-resize` |
| Link | `pointer` with underline |
| Disabled | `not-allowed` |

---

## 7. Animation Guidelines

### Timing

| Type | Duration | Easing |
|------|----------|--------|
| Micro (hover, focus) | 150ms | ease-out |
| Transition (panel, modal) | 200-300ms | cubic-bezier(0.22, 1, 0.36, 1) |
| Data update | 300ms | ease-in-out |
| Page enter | 250ms | ease-out |

### Principles

1. **Subtle, not distracting** - Data feels alive, not animated
2. **Purposeful** - Every animation communicates state
3. **Performant** - Use transform/opacity only
4. **Respectful** - Honor `prefers-reduced-motion`

### Key Animations

```css
/* Data pulse - new item arrives */
@keyframes dataPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; box-shadow: 0 0 12px var(--color-intelligence); }
}

/* Status change */
@keyframes statusChange {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

/* Node selection */
@keyframes nodeSelect {
  0% { box-shadow: 0 0 0 0 var(--color-intelligence); }
  100% { box-shadow: 0 0 0 4px transparent; }
}
```

---

## 8. Component Architecture

### Directory Structure

```
src/
├── components/
│   ├── canvas/                    # Composable workspace
│   │   ├── Canvas.tsx
│   │   ├── CanvasPanel.tsx
│   │   ├── PanelGrid.tsx
│   │   ├── DragHandle.tsx
│   │   └── ResizeHandle.tsx
│   │
│   ├── intelligence/              # Intelligence components
│   │   ├── EntityGraph.tsx
│   │   ├── EntityNode.tsx
│   │   ├── EntityEdge.tsx
│   │   ├── TimelineView.tsx
│   │   ├── CrawlStream.tsx
│   │   ├── StreamItem.tsx
│   │   └── IntelligenceLayerToggle.tsx
│   │
│   ├── inspector/                 # Entity inspector
│   │   ├── InspectorPanel.tsx
│   │   ├── MetadataSection.tsx
│   │   ├── RelationshipsSection.tsx
│   │   ├── MemorySection.tsx
│   │   └── SourceTrace.tsx
│   │
│   ├── agents/                    # Agent console
│   │   ├── AgentConsole.tsx
│   │   ├── TaskQueue.tsx
│   │   ├── TaskItem.tsx
│   │   ├── ExecutionLog.tsx
│   │   ├── DecisionTrace.tsx
│   │   └── AgentControls.tsx
│   │
│   ├── investigation/             # Investigation mode
│   │   ├── InvestigationMode.tsx
│   │   ├── PinnedEntities.tsx
│   │   ├── InvestigationNotes.tsx
│   │   └── ExportBundle.tsx
│   │
│   └── ui/                        # Base UI (existing)
│       └── ...
│
├── stores/
│   ├── canvasStore.ts             # Panel layout state
│   ├── intelligenceStore.ts       # Selected entities, filters
│   ├── agentStore.ts              # Agent task state
│   └── investigationStore.ts      # Investigation mode state
│
├── hooks/
│   ├── useEntityGraph.ts          # Graph data & interactions
│   ├── useCrawlStream.ts          # WebSocket stream
│   ├── useTimeline.ts             # Timeline data & zoom
│   ├── useAgentTasks.ts           # Agent task management
│   └── useInvestigation.ts        # Investigation mode
│
└── types/
    ├── entity.ts
    ├── intelligence.ts
    ├── agent.ts
    └── canvas.ts
```

### Store Architecture (Zustand v5)

```typescript
// stores/intelligenceStore.ts
interface IntelligenceState {
  // Selection
  selectedEntities: Set<string>;
  hoveredEntity: string | null;
  
  // Filters
  entityTypeFilter: EntityType[];
  statusFilter: StatusColor[];
  timeRange: TimeRange;
  
  // View
  intelligenceLayer: 'raw' | 'processed' | 'agent';
  memoryDepth: number; // hours
  
  // Actions
  selectEntity: (id: string) => void;
  deselectEntity: (id: string) => void;
  setFilters: (filters: Partial<Filters>) => void;
  setLayer: (layer: IntelligenceLayer) => void;
  setMemoryDepth: (hours: number) => void;
}
```

---

## 9. Implementation Priority

### Phase 1: Foundation (Week 1)

1. ✅ Update color system with functional accents
2. ⬜ Create `Canvas` and `CanvasPanel` components
3. ⬜ Update sidebar to icon-first collapsible design
4. ⬜ Create `InspectorPanel` base component

### Phase 2: Core Intelligence (Week 2)

5. ⬜ Implement `EntityGraph` with XYFlow
6. ⬜ Create `CrawlStream` with filtering
7. ⬜ Build `TimelineView` component
8. ⬜ Connect stores to existing API clients

### Phase 3: Agent Integration (Week 3)

9. ⬜ Build `AgentConsole` with task queue
10. ⬜ Create `ExecutionLog` streaming component
11. ⬜ Implement `DecisionTrace` visualization
12. ⬜ Add manual override controls

### Phase 4: Advanced Features (Week 4)

13. ⬜ Implement `InvestigationMode`
14. ⬜ Add `IntelligenceLayerToggle`
15. ⬜ Build `MemoryDepthSlider`
16. ⬜ Create keyboard shortcut system

---

## 10. Testing Requirements

### Unit Tests (Vitest)

- All components: 80% coverage minimum
- Store actions and state transitions
- Color utility functions
- Filter logic

### Integration Tests

- Graph selection → inspector update
- Filter changes → graph re-render
- Timeline zoom → data refetch
- Agent task lifecycle

### E2E Tests (Playwright)

- Full investigation workflow
- Canvas panel manipulation
- Keyboard shortcut functionality
- Real-time stream updates

### Accessibility (jest-axe)

- Color contrast: 4.5:1 minimum
- Keyboard navigation: All features accessible
- Screen reader: Entity graph described
- Focus management: Logical tab order

---

## 11. Performance Budget

| Metric | Target |
|--------|--------|
| Initial load | < 3s on 3G |
| Time to interactive | < 5s |
| Graph render (1000 nodes) | < 500ms |
| Stream item render | < 16ms |
| Panel resize | 60fps |
| Bundle size (gzipped) | < 300KB |

### Optimization Strategies

1. **Virtualization** - Use `@tanstack/react-virtual` for streams/lists
2. **Lazy loading** - ECharts and graph libraries loaded on demand
3. **Memoization** - Store-derived data memoized
4. **Web Workers** - Graph physics in worker thread
5. **WebSocket batching** - Throttle stream updates to 100ms intervals

---

## Appendix A: Color Reference

```css
:root {
  /* Background layers */
  --color-void: #0A0B10;
  --color-deep: #0F1117;
  --color-layer-0: #13151C;
  --color-layer-1: #1A1D28;
  --color-layer-2: #222633;
  --color-layer-3: #2A2F3E;
  --color-layer-4: #343A4D;
  
  /* Functional channels */
  --color-intelligence: #00D4FF;
  --color-anomaly: #FFB020;
  --color-active: #7C5CFF;
  --color-success: #2EE6A6;
  --color-critical: #FF4757;
  --color-neutral: #6B7280;
  
  /* Text */
  --color-text-primary: #F0EEF8;
  --color-text-secondary: #A09BB8;
  --color-text-muted: #5C5878;
  
  /* Borders */
  --color-border: rgba(255, 255, 255, 0.06);
  --color-border-strong: rgba(255, 255, 255, 0.12);
  --color-border-focus: #00D4FF;
}
```

---

## Appendix B: Component Props Reference

### EntityGraph

```typescript
interface EntityGraphProps {
  entities: Entity[];
  relationships: Relationship[];
  selectedIds?: Set<string>;
  onEntitySelect?: (id: string) => void;
  onEntityExpand?: (id: string) => void;
  layout?: 'force' | 'hierarchical' | 'radial';
  showMinimap?: boolean;
  showControls?: boolean;
}
```

### CrawlStream

```typescript
interface CrawlStreamProps {
  items: StreamItem[];
  paused?: boolean;
  filters?: StreamFilters;
  onItemClick?: (item: StreamItem) => void;
  onFilterChange?: (filters: StreamFilters) => void;
  maxItems?: number;
}
```

### InspectorPanel

```typescript
interface InspectorPanelProps {
  entity: Entity | null;
  onClose?: () => void;
  sections?: ('metadata' | 'relationships' | 'memory' | 'source')[];
  onEntityClick?: (id: string) => void;
  loading?: boolean;
}
```

---

**Document Status:** Ready for implementation review
**Next Step:** Begin Phase 1 implementation
