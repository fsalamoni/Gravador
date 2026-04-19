import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_EXACT_PATHS = ['/'];
const PUBLIC_PATH_PREFIXES = [
  '/download',
  '/docs',
  '/login',
  '/signup',
  '/share',
  '/privacy',
  '/terms',
  '/api/health',
  '/api/webhooks',
];

// ── In-memory rate limiter (per Edge instance) ──
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT_GENERAL = 120;
const RATE_LIMIT_AI = 15;

function checkRateLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const entry = rateMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

// Evict stale entries periodically (lightweight cleanup)
function evictStale() {
  const now = Date.now();
  for (const [k, v] of rateMap) {
    if (now > v.resetAt) rateMap.delete(k);
  }
}

let lastEvict = 0;

function getSafeRedirectPath(nextPath: string | null) {
  if (!nextPath?.startsWith('/')) return '/workspace';
  if (nextPath.startsWith('/login') || nextPath.startsWith('/signup')) return '/workspace';
  return nextPath;
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseapp.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.googleusercontent.com https://*.googleapis.com",
      "font-src 'self'",
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com https://openrouter.ai https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com",
      "frame-src https://*.firebaseapp.com https://accounts.google.com",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; '),
  );
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get('__session');

  // Periodic stale entry eviction
  const now = Date.now();
  if (now - lastEvict > 30_000) {
    evictStale();
    lastEvict = now;
  }

  // Rate limiting for API routes
  if (pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const isAI = pathname.startsWith('/api/chat') || pathname.startsWith('/api/search');
    const limit = isAI ? RATE_LIMIT_AI : RATE_LIMIT_GENERAL;
    const key = `${ip}:${isAI ? 'ai' : 'gen'}`;

    if (!checkRateLimit(key, limit)) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'rate_limit_exceeded', retryAfterMs: RATE_WINDOW_MS },
          { status: 429 },
        ),
      );
    }

    // CSRF: verify Origin for mutation requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const origin = request.headers.get('origin');
      const host = request.headers.get('host');
      if (origin && host && !origin.includes(host)) {
        return addSecurityHeaders(
          NextResponse.json({ error: 'csrf_rejected' }, { status: 403 }),
        );
      }
    }
  }

  if (session?.value && (pathname === '/login' || pathname === '/signup')) {
    const nextPath = request.nextUrl.searchParams.get('next');
    const redirectPath = getSafeRedirectPath(nextPath);

    return addSecurityHeaders(NextResponse.redirect(new URL(redirectPath, request.url)));
  }

  // Allow public paths through
  if (
    PUBLIC_EXACT_PATHS.includes(pathname) ||
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return addSecurityHeaders(NextResponse.next());
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
      return addSecurityHeaders(NextResponse.redirect(loginUrl));
    }
  }

  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
