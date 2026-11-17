// These VITE_* values are public: they are compiled into the browser app.
// Never put private keys, passwords, or server-side secrets in these variables.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() || ''
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY?.trim() || ''
export const VAPID_PUBLIEKE_SLEUTEL = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() || ''
export const WIKI_URL = import.meta.env.VITE_WIKI_URL?.trim() || ''

export const isGeconfigureerd = () => Boolean(SUPABASE_URL && SUPABASE_KEY)
export const pushGeconfigureerd = () => Boolean(VAPID_PUBLIEKE_SLEUTEL)
export const afbeeldingUrl = (pad) => `${SUPABASE_URL}/storage/v1/object/public/afbeeldingen/${pad}`
