import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { type PostgresJsDatabase, drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

export type Database = PostgresJsDatabase<typeof schema>;

/**
 * Drizzle client for server-side use (never expose to browser).
 * Connects via the session pooler URL set in DATABASE_URL.
 */
export function createDb(databaseUrl = process.env.DATABASE_URL): Database {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to create the Drizzle client');
  }
  const queryClient = postgres(databaseUrl, { prepare: false });
  return drizzle(queryClient, { schema, casing: 'snake_case' });
}

/**
 * Supabase service-role client — server-only. Bypasses RLS.
 */
export function createServiceClient(
  url = process.env.SUPABASE_URL,
  serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
): SupabaseClient {
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Supabase anon client — safe to expose. RLS enforced.
 * Accepts a user access token for per-user authenticated requests.
 */
export function createAnonClient(
  options: {
    url?: string;
    anonKey?: string;
    accessToken?: string;
  } = {},
): SupabaseClient {
  const url = options.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey =
    options.anonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase URL and anon key required');
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: options.accessToken
      ? { headers: { Authorization: `Bearer ${options.accessToken}` } }
      : undefined,
  });
}

export { schema };
