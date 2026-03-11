/**
 * Server-side Supabase admin client using service_role key.
 * This bypasses RLS and should ONLY be used in API routes (server-side).
 * Never import this in client components.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function getAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars'
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/** Lazy-initialized admin client — only created when first called at runtime. */
let _adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = getAdminClient();
  }
  return _adminClient;
}
