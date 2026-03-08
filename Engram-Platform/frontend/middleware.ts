import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isClerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const isPublicRoute = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)']);

// Middleware that conditionally enables Clerk auth
// If Clerk is not configured, all routes are accessible without auth
// Clerk v6: clerkMiddleware now receives (auth, req) and auth.protect() is async
export default clerkMiddleware(async (auth, req) => {
  // Skip auth entirely if Clerk is not configured
  if (!isClerkEnabled) {
    return;
  }

  // Protect all non-public routes
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
