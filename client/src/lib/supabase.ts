import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

function initializeSupabase(): {
  client: SupabaseClient | null
  configurationError: string | null
} {
  if (!url || !publishableKey) {
    return {
      client: null,
      configurationError:
        'Autentimine pole seadistatud. Lisa faili client/.env.local VITE_SUPABASE_URL ja VITE_SUPABASE_PUBLISHABLE_KEY ning taaskäivita arendusserver.',
    }
  }

  try {
    const parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid URL protocol')
    }
    if (publishableKey.startsWith('sb_secret_')) {
      throw new Error('A public browser key is required')
    }

    return {
      client: createClient(url, publishableKey),
      configurationError: null,
    }
  } catch {
    // Do not include configuration values or SDK errors in the UI or logs.
    return {
      client: null,
      configurationError:
        'Autentimise seadistus on vigane. Kontrolli Supabase’i projekti URL-i ja avalikku publishable-võtit failis client/.env.local.',
    }
  }
}

const { client, configurationError } = initializeSupabase()

export const supabase = client
export const supabaseConfigurationError = configurationError
