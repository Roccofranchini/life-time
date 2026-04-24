// src/lib/server/supabase.ts
// Client Supabase SERVER-ONLY.
// Ogni file sotto src/lib/server/ è automaticamente escluso dal bundle client
// da SvelteKit — NON importare questo modulo in componenti .svelte né in load
// universali.
//
// Legge SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY da env di runtime.
// Se le variabili non sono configurate (es. dev senza credenziali) il factory
// ritorna null e chi chiama deve degradare sul fallback statico.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

let cached: SupabaseClient | null | undefined;

export function getSupabaseServer(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    cached = null;
    return null;
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return cached;
}
