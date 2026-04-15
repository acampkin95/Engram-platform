import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const isAuthEnabled = Boolean(process.env.BETTER_AUTH_SECRET);

function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/setup') ||
    pathname.startsWith('/api/setup') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    /\.(html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)$/.test(
      pathname,
    )
  );
}

export async function middleware(req: NextRequest) {
  if (!isAuthEnabled) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  // Verify session via internal auth API
  const sessionCookie =
    req.cookies.get('better-auth.session_token') ??
    req.cookies.get('__Secure-better-auth.session_token');

  if (!sessionCookie) {
    const redirectUrl = new URL('/sign-in', req.url);
    if (pathname !== '/dashboard') {
      redirectUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // Session cookie exists — let the request through.
  // Invalid/expired sessions are caught at the API route level via auth.api.getSession().
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
