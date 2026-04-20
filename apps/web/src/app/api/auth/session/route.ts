import { getServerAuth, getServerDb } from '@/lib/firebase-server';
import type { Locale, UserDoc } from '@gravador/db';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { Timestamp } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

function inferLocaleFromRequest(request: Request): Locale {
  const acceptLanguage = request.headers.get('accept-language')?.toLowerCase() ?? '';
  return acceptLanguage.startsWith('pt') ? 'pt-BR' : 'en';
}

async function syncUserProfile(decodedToken: DecodedIdToken, request: Request) {
  if (!decodedToken.email) return;

  const db = getServerDb();
  const userRef = db.collection('users').doc(decodedToken.uid);
  const userSnapshot = await userRef.get();
  const existingUser = userSnapshot.exists ? (userSnapshot.data() as Partial<UserDoc>) : null;

  const profile: Partial<UserDoc> & Pick<UserDoc, 'email' | 'locale'> = {
    email: decodedToken.email,
    locale: existingUser?.locale ?? inferLocaleFromRequest(request),
  };

  if (decodedToken.name) {
    profile.fullName = decodedToken.name;
  }

  if (typeof decodedToken.picture === 'string' && decodedToken.picture.length > 0) {
    profile.avatarUrl = decodedToken.picture;
  }

  if (!userSnapshot.exists) {
    profile.createdAt = Timestamp.now();
  }

  await userRef.set(profile, { merge: true });
}

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
    const decodedToken = await auth.verifyIdToken(idToken);

    if (decodedToken.firebase.sign_in_provider !== 'google.com') {
      return NextResponse.json({ error: 'provider_not_allowed' }, { status: 403 });
    }

    await syncUserProfile(decodedToken, req);

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
