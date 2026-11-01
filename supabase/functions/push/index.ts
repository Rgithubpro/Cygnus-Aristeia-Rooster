// Sends Web Push notifications.
//   actie "herinneringen": called every minute by pg_cron (header x-cron-secret)
//   actie "handmatig":     Root (Authorization: Bearer <login token>) or a class admin (body.token)
// Secrets to set: CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com)
import postgres from 'npm:postgres@3.4.4'
import webpush from 'npm:web-push@3.6.7'

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 1, prepare: false })
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

type Sub = { id: string; endpoint: string; p256dh: string; auth: string }

async function verstuur(items: { sub: Sub; payload: object }[]) {
  let ok = 0
  const dood: string[] = []
  for (let i = 0; i < items.length; i += 25) {
    await Promise.all(items.slice(i, i + 25).map(async ({ sub, payload }) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 3600, urgency: 'high' },
        )
        ok++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) dood.push(sub.id)
      }
    }))
  }
  if (dood.length) await sql`delete from public.push_abonnementen where id = any(${sql.array(dood)}::uuid[])`
  return { ok, mislukt: items.length - ok }
}

function jwtPayload(jwt: string): { aal?: string } {
  try {
    const deel = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(deel.padEnd(deel.length + ((4 - (deel.length % 4)) % 4), '=')))
  } catch {
    return {}
  }
}

// Returns the user id when the bearer token belongs to a Root user (with 2FA if enabled).
async function rootUid(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  const jwt = auth.slice(7)
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: req.headers.get('apikey') ?? '', Authorization: `Bearer ${jwt}` },
  })
  if (!r.ok) return null
  const user = await r.json()
  if (!user?.id) return null
  const [rij] = await sql`select public._root_controle(${user.id}::uuid, ${jwtPayload(jwt).aal ?? 'aal1'}) as ok`
  return rij?.ok ? user.id : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json()

    if (body.actie === 'herinneringen') {
      if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) return json({ ok: false, error: 'geen_toegang' }, 401)
      const rijen = await sql`select leerling, onderwerp, starttijd, plek from public._herinneringen_nu()`
      if (rijen.length === 0) return json({ ok: true, verstuurd: 0 })
      const ids = [...new Set(rijen.map((r) => r.leerling as string))]
      const subs = await sql<(Sub & { leerling_id: string })[]>`
        select id, leerling_id, endpoint, p256dh, auth from public.push_abonnementen
         where leerling_id = any(${sql.array(ids)}::uuid[])`
      const items = rijen.flatMap((r) =>
        subs.filter((s) => s.leerling_id === r.leerling).map((sub) => ({
          sub,
          payload: { title: `Straks: ${r.onderwerp}`, body: `${r.starttijd}${r.plek ? `, ${r.plek}` : ''}`, tag: 'herinnering', url: '/' },
        })))
      const res = await verstuur(items)
      return json({ ok: true, verstuurd: res.ok, mislukt: res.mislukt })
    }

    if (body.actie === 'handmatig') {
      const titel = String(body.titel ?? '').trim().slice(0, 80)
      const tekst = String(body.tekst ?? '').trim().slice(0, 300)
      if (!titel) return json({ ok: false, error: 'titel_verplicht' }, 400)
      const prefix = `${SUPABASE_URL}/storage/v1/object/public/afbeeldingen/`
      const afbeelding = typeof body.afbeelding === 'string' && body.afbeelding.startsWith(prefix) ? body.afbeelding : undefined

      let isRoot = false
      let eigenKlas: string | null = null
      if (await rootUid(req)) {
        isRoot = true
      } else if (body.token) {
        try {
          const [s] = await sql`select klas_id, rol from public._sessie(${String(body.token)})`
          if (!s || s.rol !== 'beheer') return json({ ok: false, error: 'geen_rechten' }, 403)
          eigenKlas = s.klas_id
        } catch {
          return json({ ok: false, error: 'sessie_ongeldig' }, 401)
        }
      } else {
        return json({ ok: false, error: 'geen_toegang' }, 401)
      }

      let subs: Sub[]
      if (body.doelgroep === 'iedereen') {
        if (!isRoot) return json({ ok: false, error: 'geen_rechten' }, 403)
        subs = await sql<Sub[]>`select id, endpoint, p256dh, auth from public.push_abonnementen`
      } else if (body.doelgroep === 'klas') {
        const klas = isRoot ? body.klas_id : eigenKlas
        if (!klas) return json({ ok: false, error: 'klas_verplicht' }, 400)
        subs = await sql<Sub[]>`
          select p.id, p.endpoint, p.p256dh, p.auth from public.push_abonnementen p
            join public.leerlingen l on l.id = p.leerling_id where l.klas_id = ${klas}::uuid`
      } else if (body.doelgroep === 'leerling') {
        subs = await sql<Sub[]>`
          select p.id, p.endpoint, p.p256dh, p.auth from public.push_abonnementen p
            join public.leerlingen l on l.id = p.leerling_id
           where l.id = ${body.leerling_id}::uuid and (${isRoot}::boolean or l.klas_id = ${eigenKlas}::uuid)`
      } else {
        return json({ ok: false, error: 'onbekende_doelgroep' }, 400)
      }

      const res = await verstuur(subs.map((sub) => ({ sub, payload: { title: titel, body: tekst, image: afbeelding, url: '/' } })))
      return json({ ok: true, verstuurd: res.ok, mislukt: res.mislukt, apparaten: subs.length })
    }

    return json({ ok: false, error: 'onbekende_actie' }, 400)
  } catch (e) {
    console.error(e)
    return json({ ok: false, error: 'serverfout' }, 500)
  }
})
