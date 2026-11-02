import { VAPID_PUBLIEKE_SLEUTEL, pushGeconfigureerd } from './config.js'
import { rpc } from './api.js'

export const pushOndersteund = () =>
  pushGeconfigureerd() && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

function naarUint8(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

// `serviceWorker.ready` never resolves when no service worker is registered (for example in dev mode).
const swKlaar = () =>
  Promise.race([navigator.serviceWorker.ready, new Promise((_, nee) => setTimeout(() => nee(new Error('geen_service_worker')), 4000))])

// Links this device's browser subscription to the student of the current session (safe to repeat).
async function registreer(token) {
  const reg = await swKlaar()
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: naarUint8(VAPID_PUBLIEKE_SLEUTEL) }))
  const j = sub.toJSON()
  await rpc('push_aanmelden', { p_token: token, p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth })
}

// The truth lives in the browser (permission + subscription), not in a note we store ourselves.
export async function meldingenStatus(token, leerlingId) {
  const toegestaan = 'Notification' in window ? Notification.permission : 'denied'
  if (!pushOndersteund() || toegestaan !== 'granted') return { toegestaan, aan: false }
  try {
    const reg = await swKlaar()
    if (!(await reg.pushManager.getSubscription())) return { toegestaan, aan: false }
    if (leerlingId) await registreer(token) // make sure the server links it to the current student
    return { toegestaan, aan: true }
  } catch {
    return { toegestaan, aan: false }
  }
}

export async function zetMeldingenAan(token) {
  const toestemming = await Notification.requestPermission()
  if (toestemming !== 'granted') return false
  await registreer(token)
  return true
}

export async function zetMeldingenUit(token) {
  const reg = await swKlaar()
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    await rpc('push_afmelden', { p_token: token, p_endpoint: sub.endpoint }).catch(() => {})
    await sub.unsubscribe().catch(() => {})
  }
}

// Re-links this device after a new login or a name change, but only if notifications were already on here.
export async function herregistreer(token) {
  if (!pushOndersteund() || Notification.permission !== 'granted') return
  try {
    const reg = await swKlaar()
    if (await reg.pushManager.getSubscription()) await registreer(token)
  } catch {
    /* try again next time */
  }
}
