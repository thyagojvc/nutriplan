import { createClient } from '@supabase/supabase-js'

// Cliente com service_role — bypassa RLS.
// Usar APENAS em Route Handlers e Server Actions de sistema (Camada 3).
// NUNCA importar em Client Components ou expor ao browser.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
