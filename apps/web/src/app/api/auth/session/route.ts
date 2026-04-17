import { getServerAuth } from '@/lib/firebase-server';
import { NextResponse } from 'next/server';

/**
 * POST /api/auth/session
 * Exchange a Firebase ID token for a session cookie.
 * Called from the client after successful Firebase Auth sign-in.
 */
export async function POST(req: Request) {
  const { idToken } = (await req.json()) as { idToken: string };
  if (!idToken) {
    return NextResponse.json({ error: 'missing_token' }, { status: 400 });
  }

  const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
  try {
    const auth = getServerAuth();
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
    const response = NextResponse.json({ ok: true });
    response.cookies.set('__session', sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return response;
  } catch (error) {
    console.error('[auth/session] Failed to create session cookie:', error);
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }
}

/**
 * DELETE /api/auth/session
 * Sign out — clear the session cookie.
 */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set('__session', '', {
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  return response;
}
