import { SUPABASE_URL, SUPABASE_KEY } from '../config.js'

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

async function verkleind(bestand) {
  const bmp = await createImageBitmap(bestand)
  const schaal = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * schaal)
  canvas.height = Math.round(bmp.height * schaal)
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
}

// Shrinks the picture to max 1600px, uploads it (Root only, enforced by storage policy), returns the file name.
export async function uploadAfbeelding(bestand) {
  if (!bestand.type.startsWith('image/')) throw new Error('Dit is geen afbeelding.')
  const blob = await verkleind(bestand)
  const pad = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.jpg`
  const c = await rootClient()
  const { error } = await c.storage.from('afbeeldingen').upload(pad, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  return pad
}

export async function verwijderAfbeelding(pad) {
  const c = await rootClient()
  await c.storage.from('afbeeldingen').remove([pad])
}
