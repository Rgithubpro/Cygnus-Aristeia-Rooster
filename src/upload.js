import { SUPABASE_URL, SUPABASE_KEY } from './config.js'
import { verkleind } from './afbeelding.js'

// Class admins have no Supabase account. For uploads they get an anonymous Supabase login and then ask the database
// for upload rights for THEIR OWN class folder (checked with their class session). Loaded only when needed.
let belofte
function client() {
  if (!belofte) {
    belofte = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { storageKey: 'sb-klassenstrijd-upload', persistSession: true, autoRefreshToken: true },
      }),
    )
  }
  return belofte
}

async function toegang(sessie) {
  const c = await client()
  const { data } = await c.auth.getSession()
  if (!data.session) {
    const { error } = await c.auth.signInAnonymously()
    if (error) throw new Error('anoniem_uit')
  }
  const { data: r, error } = await c.rpc('upload_toegang', { p_token: sessie.token })
  if (error) throw new Error(error.message)
  return { c, klasId: r.klas_id }
}

export async function uploadKlasAfbeelding(sessie, bestand, maxPx = 1600) {
  if (!bestand.type.startsWith('image/')) throw new Error('geen_afbeelding')
  const { c, klasId } = await toegang(sessie)
  const blob = await verkleind(bestand, maxPx)
  const pad = `${klasId}/${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}.jpg`
  const { error } = await c.storage.from('afbeeldingen').upload(pad, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw new Error(error.message)
  return pad
}

export async function verwijderKlasAfbeelding(sessie, pad) {
  if (!pad) return
  const { c } = await toegang(sessie)
  await c.storage.from('afbeeldingen').remove([pad])
}

// Uploads a ready-made PNG (app icons) without converting it.
export async function uploadKlasPng(sessie, blob, naam) {
  const { c, klasId } = await toegang(sessie)
  const pad = `${klasId}/${naam}`
  const { error } = await c.storage.from('afbeeldingen').upload(pad, blob, { contentType: 'image/png', upsert: false })
  if (error) throw new Error(error.message)
  return pad
}
