import { getServerAuth, getSessionUser } from './firebase-server';

/**
 * Resolve the authenticated user from either:
 * 1) web session cookie (__session) or
 * 2) Firebase ID token in Authorization: Bearer <token>
 */
export async function getApiSessionUser(req: Request) {
  const cookieUser = await getSessionUser();
  if (cookieUser) return cookieUser;

  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authHeader) return null;

  const [scheme, token] = authHeader.trim().split(/\s+/, 2);
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;

  try {
    return await getServerAuth().verifyIdToken(token);
  } catch {
    return null;
  }
}
