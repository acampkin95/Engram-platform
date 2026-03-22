<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# types

## Purpose

TypeScript type definitions and runtime validation schemas. Provides type safety for API responses, form inputs, and domain entities. Separated from component logic for reusability across components, hooks, and stores.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Type exports (barrel file) |
| `crawler.ts` | Crawler API types (crawls, investigations, etc.) |
| `memory.ts` | Memory API types (memories, matters, etc.) |
| `schemas.ts` | Zod schemas for runtime validation |

## For AI Agents

### Working In This Directory

1. **Creating Types**
   - Define interfaces for domain entities
   - Export from types/index.ts
   - Keep types minimal and focused
   - Document complex types with JSDoc

2. **Schemas (Zod)**
   - Create runtime validation for API responses
   - Form input validation
   - Request body validation
   - Colocate with types

3. **Type Organization**
   - API response types in `crawler.ts`, `memory.ts`
   - Form types in `schemas.ts`
   - Utility types as needed
   - Export all from `index.ts`

### Testing Requirements

- **Schemas:** Unit tests for validation
- **Type Safety:** Use `type` assertions sparingly
- **API Types:** Match actual API responses

### Common Patterns

1. **API Response Type**
   ```tsx
   // src/types/crawler.ts
   export interface Crawl {
     id: string;
     url: string;
     status: 'pending' | 'running' | 'completed' | 'failed';
     createdAt: string;
     updatedAt: string;
     results: CrawlResult[];
   }

   export interface CrawlResult {
     url: string;
     title: string;
     content: string;
     metadata: Record<string, unknown>;
   }
   ```

2. **Zod Schema with Type Inference**
   ```tsx
   // src/types/schemas.ts
   import { z } from 'zod';

   export const CrawlSchema = z.object({
     id: z.string().uuid(),
     url: z.string().url(),
     status: z.enum(['pending', 'running', 'completed', 'failed']),
     createdAt: z.string().datetime(),
     updatedAt: z.string().datetime(),
   });

   export type Crawl = z.infer<typeof CrawlSchema>;
   ```

3. **Form Input Schema**
   ```tsx
   // src/types/schemas.ts
   export const CreateCrawlSchema = z.object({
     url: z.string().url('Must be a valid URL'),
     depth: z.number().min(1).max(5),
     followLinks: z.boolean().default(true),
   });

   export type CreateCrawlInput = z.infer<typeof CreateCrawlSchema>;
   ```

4. **Memory Entity Types**
   ```tsx
   // src/types/memory.ts
   export interface Memory {
     id: string;
     content: string;
     tier: 1 | 2 | 3;
     projectId?: string;
     tenantId?: string;
     createdAt: string;
     updatedAt: string;
     expiresAt?: string;
   }

   export interface Matter {
     id: string;
     name: string;
     description: string;
     status: 'open' | 'closed';
     createdAt: string;
     memories: string[]; // Memory IDs
   }
   ```

5. **Type Validation in Component**
   ```tsx
   // Component using schema
   import { CreateCrawlSchema } from '@/types/schemas';
   import { useForm } from 'react-hook-form';
   import { zodResolver } from '@hookform/resolvers/zod';

   export function CrawlForm() {
     const form = useForm({
       resolver: zodResolver(CreateCrawlSchema),
     });

     return (
       <form onSubmit={form.handleSubmit(onSubmit)}>
         <input {...form.register('url')} />
         {form.formState.errors.url && <span>{form.formState.errors.url.message}</span>}
       </form>
     );
   }
   ```

## Type Index

### Crawler Types (crawler.ts)

- `Crawl` — Web crawl job
- `CrawlResult` — Crawl output
- `Investigation` — Investigation record
- `KnowledgeGraphNode` — Graph node
- `KnowledgeGraphEdge` — Graph relationship

### Memory Types (memory.ts)

- `Memory` — Memory entry
- `Matter` — Investigation/matter
- `Entity` — Knowledge entity
- `Relation` — Entity relationship

### Schemas (schemas.ts)

- `CrawlSchema` — Validate crawl data
- `CreateCrawlSchema` — Validate form input
- `SearchQuerySchema` — Search validation
- `MemorySchema` — Memory validation

## Validation Patterns

**API Response Validation:**
```tsx
const response = await fetch(url);
const data = await response.json();
const validated = CrawlSchema.parse(data); // Throws on invalid
```

**Safe Parsing (no throw):**
```tsx
const result = CrawlSchema.safeParse(data);
if (result.success) {
  const crawl = result.data;
} else {
  console.error(result.error);
}
```

**Form Validation:**
```tsx
const form = useForm({
  resolver: zodResolver(CreateCrawlSchema),
  mode: 'onChange', // Validate on change
});
```

## Dependencies

- zod@3.25.76 (Runtime validation)
- typescript (Type checking)

## Code Style

- Single quotes (')
- 100 char width
- 2-space indent
- JSDoc for complex types
- Export all from index.ts

## Type Safety Guidelines

1. **Avoid `any`:** Use generics instead
   ```tsx
   // Bad
   const data: any = response.json();

   // Good
   const data: Crawl = await CrawlSchema.parse(response.json());
   ```

2. **Use `z.infer<typeof Schema>`:** DRY principle
   ```tsx
   const schema = z.object({ ... });
   type Crawl = z.infer<typeof schema>; // No duplication
   ```

3. **Strict Mode:** TypeScript strict in tsconfig.json
   - Catches null/undefined issues
   - Requires explicit types

4. **Readonly for Immutable:** Mark immutable types
   ```tsx
   export interface ReadonlyCrawl {
     readonly id: string;
     readonly url: string;
   }
   ```

## Known Patterns

1. **Branded Types (for safety):**
   ```tsx
   type CrawlID = string & { readonly __brand: 'CrawlID' };
   ```

2. **Discriminated Unions:**
   ```tsx
   type Result = { status: 'success'; data: Crawl } | { status: 'error'; error: string };
   ```

3. **Generic API Response:**
   ```tsx
   interface ApiResponse<T> {
     data: T;
     error?: string;
     timestamp: string;
   }
   ```

<!-- MANUAL: Add type-specific patterns as they emerge -->
