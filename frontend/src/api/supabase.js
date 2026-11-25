/**
 * Supabase client initialization.
 * 
 * Provides the shared Supabase SDK client instance for client-side authentication,
 * session renewal, and user registration against the Supabase GoTrue engine.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

/** Whether both public Supabase project variables are configured for this build. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    'BillingStream: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not defined. ' +
    'Authentication will fail closed until Supabase credentials are configured.',
  );
}

/**
 * Singleton Supabase client instance.
 * Automatically persists session tokens in localStorage and handles token refresh.
 */
export const supabase = createClient(
  supabaseUrl || 'https://unconfigured.invalid',
  supabaseAnonKey || 'unconfigured-anon-key',
  {
    auth: {
      persistSession: isSupabaseConfigured,
      autoRefreshToken: isSupabaseConfigured,
      detectSessionInUrl: isSupabaseConfigured,
    },
  },
);
