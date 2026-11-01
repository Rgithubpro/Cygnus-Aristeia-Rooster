import { VAPID_PUBLIEKE_SLEUTEL, pushGeconfigureerd } from './config.js'
import { rpc } from './api.js'

const FLAG = 'ks.meldingen'

export const pushOndersteund = () =>
  pushGeconfigureerd() && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const meldingenStatus = () => ({
  toegestaan: 'Notification' in window ? Notification.permission : 'denied',
  aan: localStorage.getItem(FLAG) === 'aan',
})

function naarUint8(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function registreer(token) {
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: naarUint8(VAPID_PUBLIEKE_SLEUTEL) }))
  const j = sub.toJSON()
  await rpc('push_aanmelden', { p_token: token, p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth })
}

export async function zetMeldingenAan(token) {
  const toestemming = await Notification.requestPermission()
  if (toestemming !== 'granted') return false
  await registreer(token)
  localStorage.setItem(FLAG, 'aan')
  return true
}

export async function zetMeldingenUit(token) {
  localStorage.removeItem(FLAG)
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    await rpc('push_afmelden', { p_token: token, p_endpoint: sub.endpoint }).catch(() => {})
    await sub.unsubscribe().catch(() => {})
  }
}

// Re-links this device to the current student (after a name change or a new session).
export async function herregistreer(token) {
  if (!pushOndersteund() || Notification.permission !== 'granted' || localStorage.getItem(FLAG) !== 'aan') return
  try {
    await registreer(token)
  } catch {
    /* try again next time */
  }
}
