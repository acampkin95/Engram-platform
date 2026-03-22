<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# api

## Purpose

API route handlers for server-side endpoints. Handles health checks, webhook processing, and any server-only logic that needs HTTP exposure. All routes are server-side only (no client-side access to handler logic).

## Key Files

| File | Description |
|------|-------------|
| `health/route.ts` | Health check endpoint (public, GET) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `health/` | Health check service |

## For AI Agents

### Working In This Directory

1. **Creating API Routes**
   - Create `route.ts` in directory matching desired path
   - Export function per HTTP method: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`
   - Signature: `async function METHOD(request: Request) { ... }`

2. **Request Handling**
   - Use `request.json()` for JSON payload
   - Use `request.formData()` for form data
   - Use `request.text()` for text
   - Request URL params via `request.nextUrl.searchParams`

3. **Response**
   - Return `Response` or `Response.json()`
   - HTTP status codes: 200, 201, 204, 400, 401, 403, 404, 500, etc.
   - Set headers: `return new Response(..., { headers: { ... } })`

4. **Authentication**
   - Use Clerk `auth()` function to get user session
   - Verify bearer tokens manually if needed
   - Protect endpoints by checking `userId`

### Testing Requirements

- **API Routes:** Test via `fetch()` or API client
- **Authentication:** Test with/without Clerk session
- **Error Cases:** Test 400, 401, 403, 404, 500 responses
- Coverage: All API routes should have unit or E2E coverage

### Common Patterns

1. **Basic GET Endpoint**
   ```tsx
   // app/api/health/route.ts
   export async function GET() {
     return Response.json({ status: 'ok', timestamp: new Date() });
   }
   ```

2. **Protected Endpoint (Clerk Auth)**
   ```tsx
   // app/api/protected/route.ts
   import { auth } from '@clerk/nextjs/server';

   export async function GET() {
     const { userId } = await auth();
     if (!userId) {
       return Response.json({ error: 'Unauthorized' }, { status: 401 });
     }
     return Response.json({ data: 'sensitive' });
   }
   ```

3. **POST with JSON Body**
   ```tsx
   // app/api/items/route.ts
   export async function POST(request: Request) {
     const body = await request.json();
     // Validate body with zod
     // Store in DB
     return Response.json({ id: '123' }, { status: 201 });
   }
   ```

4. **With Error Handling**
   ```tsx
   export async function GET(request: Request) {
     try {
       const data = await fetchFromExternalAPI();
       return Response.json(data);
     } catch (error) {
       console.error(error);
       return Response.json(
         { error: 'Internal Server Error' },
         { status: 500 },
       );
     }
   }
   ```

5. **With CORS Headers**
   ```tsx
   export async function OPTIONS() {
     return new Response(null, {
       status: 200,
       headers: {
         'Access-Control-Allow-Origin': '*',
         'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
       },
     });
   }
   ```

## Dependencies

- next (Request/Response types)
- @clerk/nextjs (Optional: auth middleware)

## Code Style

- Keep business logic minimal (delegate to lib/)
- Always validate input with zod
- Always handle errors
- Always return appropriate HTTP status codes

## Key Routes

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/health` | GET | Health check | Public |

## Known Patterns

1. **No Client-Side Access:** API route handlers are server-only
   - Safe for secrets and sensitive logic
   - Cannot be accessed from `browser/node_modules`

2. **Streaming Responses:** Supported via `ReadableStream`
   ```tsx
   export async function GET() {
     const stream = new ReadableStream({
       start(controller) { ... }
     });
     return new Response(stream);
   }
   ```

3. **Middleware Integration:** Clerk middleware runs before API routes
   - User session available via `auth()`
   - Protected routes return 401 if no session

<!-- MANUAL: Add endpoints as they are created -->
