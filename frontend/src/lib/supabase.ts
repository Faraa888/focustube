import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Log environment variables for debugging (don't log full keys)
console.log('🔍 [Supabase] Environment check:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'missing'
});

if (!supabaseUrl || !supabaseAnonKey) {
  const error = 'Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel.';
  console.error('🔴 [Supabase]', error);
  // Don't throw - create a dummy client so the app doesn't crash
  // This will fail on actual API calls, but at least the page loads
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true, // Important for OAuth redirects
      },
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

if (supabaseUrl && supabaseAnonKey) {
  console.log('✅ [Supabase] Client initialized successfully');
} else {
  console.warn('⚠️ [Supabase] Using placeholder client - set environment variables in Vercel');
}

