/**
 * Supabase client initialization.
 * 
 * Provides the shared Supabase SDK client instance for client-side authentication,
 * session renewal, and user registration against the Supabase GoTrue engine.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'BillingStream: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not defined. ' +
    'Supabase cloud authentication requires these environment variables.'
  );
}

/**
 * Singleton Supabase client instance.
 * Automatically persists session tokens in localStorage and handles token refresh.
 */
export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
