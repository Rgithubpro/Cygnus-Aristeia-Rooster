import { SUPABASE_URL, SUPABASE_KEY } from '../config.js'
import { verkleind } from '../afbeelding.js'

// The Supabase library is only loaded for Root (dynamic import), so students never download it.
let belofte
export function rootClient() {
  if (!belofte) {
    belofte = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { storageKey: 'sb-klassenstrijd-root', persistSession: true, autoRefreshToken: true },
      }),
    )
  }
  return belofte
}

export async function rootRpc(naam, args = {}) {
  const c = await rootClient()
  const { data, error } = await c.rpc(naam, args)
  if (error) {
    const e = new Error(error.message)
    e.code = error.message
    throw e
  }
  return data
}

export async function rootToken() {
  const c = await rootClient()
  const { data } = await c.auth.getSession()
  return data.session?.access_token
}

// Shrinks the picture (default max 1600px), uploads it (Root only, enforced by the storage policy), returns the path.
// `map` puts it in a folder, for example a class id for a class logo.
export async function uploadAfbeelding(bestand, map = '', maxPx = 1600) {
  if (!bestand.type.startsWith('image/')) throw new Error('Dit is geen afbeelding.')
  const blob = await verkleind(bestand, maxPx)
  const naam = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.jpg`
  const pad = map ? `${map}/${naam}` : naam
  const c = await rootClient()
  const { error } = await c.storage.from('afbeeldingen').upload(pad, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  return pad
}

export async function verwijderAfbeelding(pad) {
  const c = await rootClient()
  await c.storage.from('afbeeldingen').remove([pad])
}
