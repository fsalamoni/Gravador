import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_EXACT_PATHS = ['/'];
const PUBLIC_PATH_PREFIXES = [
  '/download',
  '/docs',
  '/login',
  '/signup',
  '/share',
  '/api/health',
  '/api/webhooks',
];

function getSafeRedirectPath(nextPath: string | null) {
  if (!nextPath?.startsWith('/')) return '/workspace';
  if (nextPath.startsWith('/login') || nextPath.startsWith('/signup')) return '/workspace';
  return nextPath;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get('__session');

  if (session?.value && (pathname === '/login' || pathname === '/signup')) {
    const nextPath = request.nextUrl.searchParams.get('next');
    const redirectPath = getSafeRedirectPath(nextPath);

    return NextResponse.redirect(new URL(redirectPath, request.url));
  }

  // Allow public paths through
  if (
    PUBLIC_EXACT_PATHS.includes(pathname) ||
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/)
  ) {
    return NextResponse.next();
  }

  // For workspace routes, check for session cookie
  if (pathname.startsWith('/workspace')) {
    if (!session?.value) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
