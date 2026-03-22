<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# intelligence

## Purpose

Intelligence and RAG (Retrieval-Augmented Generation) feature routes. Provides UI for RAG chat, investigation search, and knowledge graph visualization from the Engram-AiMemory backend (port 8000). Integrates with MCP server for tool-augmented responses.

## Key Files

| File | Description |
|------|-------------|
| `layout.tsx` | Intelligence section layout |
| `page.tsx` | Intelligence redirect (to `/chat`) |
| `error.tsx` | Error boundary for intelligence routes |
| `loading.tsx` | Loading skeleton |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `chat/` | RAG chat interface |
| `investigations/` | Investigation search and browser |
| `knowledge-graph/` | Knowledge graph visualization |
| `search/` | Search interface |

## For AI Agents

### Working In This Directory

1. **Memory API Integration**
   - Memory API URL: `process.env.NEXT_PUBLIC_MEMORY_API_URL` (port 8000)
   - Use `useMemoryAPI()` hook from `@/lib/memory-client.ts`
   - Data fetched via SWR with revalidation

2. **RAG Chat**
   - Custom hook: `useRAGChat()` in `@/hooks/useRAGChat.ts`
   - Manages chat history, streaming responses, tool calls
   - Integrates with MCP server (optional)

3. **Types**
   - Memory types: `@/types/memory.ts`
   - Chat/investigation schemas: `@/types/schemas.ts`

### Testing Requirements

- **Chat Components:** Unit tests with MSW mocking
- **Pages:** E2E tests for search/navigation
- **RAG Hook:** Unit tests for message flow
- Coverage: 80% statements minimum

### Common Patterns

1. **RAG Chat Component**
   ```tsx
   'use client';
   import { useRAGChat } from '@/hooks/useRAGChat';

   export function ChatContent() {
     const {
       messages,
       input,
       isLoading,
       handleSubmit,
     } = useRAGChat();

     return (
       <div>
         <MessageList messages={messages} />
         <ChatInput
           value={input}
           onSubmit={handleSubmit}
           isLoading={isLoading}
         />
       </div>
     );
   }
   ```

2. **Using Memory API**
   ```tsx
   'use client';
   import { useMemoryAPI } from '@/lib/memory-client';

   export function InvestigationBrowser() {
     const { data: investigations } = useMemoryAPI('/investigations');
     return <InvestigationList data={investigations} />;
   }
   ```

3. **Knowledge Graph Rendering**
   ```tsx
   'use client';
   import { Handle, Position } from '@xyflow/react';

   export function KnowledgeGraphViewer({ data }) {
     return (
       <ReactFlow nodes={data.nodes} edges={data.edges}>
         <Background />
         <Controls />
       </ReactFlow>
     );
   }
   ```

## Directory Structure

```
intelligence/
├── layout.tsx              # Intelligence layout
├── page.tsx                # Redirect to /chat
├── error.tsx               # Error boundary
├── loading.tsx             # Loading skeleton
├── chat/                   # RAG chat
│   ├── page.tsx
│   ├── loading.tsx
│   ├── error.tsx
│   └── ChatContent.tsx
├── investigations/         # Investigation search
│   ├── page.tsx
│   ├── loading.tsx
│   └── (content component)
├── knowledge-graph/        # Graph visualization
│   ├── page.tsx
│   ├── loading.tsx
│   └── KnowledgeGraphContent.tsx
└── search/                 # Search interface
    └── page.tsx
```

## Key Routes

| Route | Purpose |
|-------|---------|
| `/dashboard/intelligence` | Redirect to chat |
| `/dashboard/intelligence/chat` | RAG chat interface |
| `/dashboard/intelligence/investigations` | Investigation search |
| `/dashboard/intelligence/knowledge-graph` | Graph viewer |
| `/dashboard/intelligence/search` | Search interface |

## Memory API Integration

**Base URL:** `process.env.NEXT_PUBLIC_MEMORY_API_URL` (default: http://localhost:8000)

**Key Endpoints:**
- `POST /memories/search` — Hybrid search + reranking
- `GET /memories/:id` — Get memory
- `POST /investigations` — Create investigation
- `GET /investigations/:id` — Get investigation
- `GET /entities` — List entities
- `GET /knowledge-graph` — Get graph

## RAG Chat Hook

The `useRAGChat()` hook manages:
- Chat message history
- Streaming responses from MCP server
- Tool calls (memory search, entity lookup, etc.)
- Error handling and retries

```tsx
const { messages, input, isLoading, handleSubmit } = useRAGChat();
// messages: Message[]
// input: string (current user input)
// isLoading: boolean (streaming response)
// handleSubmit: (message: string) => Promise<void>
```

## Dependencies

- @/lib/memory-client (SWR hooks)
- @/hooks/useRAGChat (RAG chat management)
- @/types/memory (Type definitions)
- @xyflow/react (Graph visualization)
- swr (Data fetching)

## Code Style

- Single quotes (')
- 100 char width
- 2-space indent
- 'use client' for interactive components

## Known Patterns

1. **RAG Chat Flow:**
   - User submits message
   - Hook sends to backend/MCP server
   - Streaming response received
   - Tools called (memory search, etc.)
   - Response displayed with citations

2. **Error Handling:** Graceful degradation
   - Failed searches show error message
   - Retries with exponential backoff
   - Fallback to direct memory queries

3. **Memory Tiers:** Three-tier memory system
   - Tier 1: Project/Matter specific
   - Tier 2: Workspace/User general
   - Tier 3: Global system knowledge

<!-- MANUAL: Add intelligence-specific patterns as they emerge -->
