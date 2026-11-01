import { SUPABASE_URL, SUPABASE_KEY } from './config.js'

let bijOngeldigeSessie = () => {}
export function setBijOngeldigeSessie(fn) {
  bijOngeldigeSessie = fn
}

// Calls a Postgres function in supabase/schema.sql (class session functions).
export async function rpc(naam, args = {}) {
  const headers = { 'Content-Type': 'application/json', apikey: SUPABASE_KEY }
  // Only legacy JWT-style keys (eyJ...) go in Authorization; new sb_publishable_ keys must not.
  if (SUPABASE_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SUPABASE_KEY}`

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${naam}`, { method: 'POST', headers, body: JSON.stringify(args) })
  const tekst = await res.text()
  let data = null
  try {
    data = tekst ? JSON.parse(tekst) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const code = data?.message || `http_${res.status}`
    if (code === 'sessie_ongeldig') bijOngeldigeSessie()
    const fout = new Error(code)
    fout.code = code
    throw fout
  }
  return data
}

// Calls the "push" Edge Function. Root passes its login token, class admins pass body.token.
export async function pushVersturen(body, rootToken) {
  const headers = { 'Content-Type': 'application/json', apikey: SUPABASE_KEY }
  if (rootToken) headers.Authorization = `Bearer ${rootToken}`
  const res = await fetch(`${SUPABASE_URL}/functions/v1/push`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ actie: 'handmatig', ...body }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) throw new Error(data.error || `http_${res.status}`)
  return data
}
