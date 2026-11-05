// All three values are PUBLIC by design and safe to commit.
// - Supabase: Project Settings -> API (Project URL + anon/publishable key). The key only lets the app
//   call the functions in supabase/schema.sql; those check a class password or a Root login.
// - VAPID public key: generate a pair with `npx web-push generate-vapid-keys`
//   (the PRIVATE key never goes in this repo, only in the Edge Function secrets).
export const SUPABASE_URL = 'https://ijkfnntmrkqkoqymbixo.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_ZPrw5X2bkh6S0Ig6owQf9g_P6vA5btL'
export const VAPID_PUBLIEKE_SLEUTEL = 'BAw1s5WJV8TJGuJdUXSYP5xxEahmXAr4tMb8p2ddSqNG2tYhH32BUc6ba-M8uo1cQ90c4CRjO9NHEU293LsTrcQ'

export const isGeconfigureerd = () => !SUPABASE_URL.includes('JOUW')
export const pushGeconfigureerd = () => !VAPID_PUBLIEKE_SLEUTEL.includes('JOUW')
export const afbeeldingUrl = (pad) => `${SUPABASE_URL}/storage/v1/object/public/afbeeldingen/${pad}`