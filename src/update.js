import { registerSW } from 'virtual:pwa-register'

// Keeps everyone on the newest version, also on phones that cling to old files:
// 1. a new service worker is applied when nobody is typing, 2. /version.json is checked every 2 minutes,
// 3. if the app stays outdated for several checks, caches are wiped and the app reloads once (max every 10 minutes).
const LOKAAL = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : ''
let wacht = false
let achterstand = 0
let registratie = null
let updateSW = () => {}
const luisteraars = new Set()

export const bijUpdate = (fn) => {
  luisteraars.add(fn)
  fn(wacht)
  return () => luisteraars.delete(fn)
}
const meld = () => luisteraars.forEach((f) => f(wacht))
export const versieInfo = () => ({ lokaal: LOKAAL, wacht, achterstand })

const bezigMetTypen = () => {
  const el = document.activeElement
  return (!!el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) || !!document.querySelector('.modal')
}

// Throws away service workers and caches, then reloads. Login and settings of this device stay.
export async function herstel() {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) || []
    await Promise.all(regs.map((r) => r.unregister()))
    if ('caches' in window) await Promise.all((await caches.keys()).map((n) => caches.delete(n)))
  } catch {
    /* reload anyway */
  }
  location.reload()
}

export function pasToe() {
  wacht = false
  meld()
  updateSW(true)
}

function probeer() {
  if (wacht && !bezigMetTypen()) pasToe()
}

async function controleer() {
  let nieuw = false
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (r.ok) {
      const v = await r.json()
      nieuw = !!(v.id && LOKAAL && v.id !== LOKAAL)
    }
  } catch {
    return // offline
  }
  if (!nieuw) {
    achterstand = 0
    return
  }
  achterstand++
  wacht = true
  meld()
  registratie?.update().catch(() => {})
  if (achterstand >= 4 && !bezigMetTypen()) {
    const laatste = Number(localStorage.getItem('ksv.herstel') || 0)
    if (Date.now() - laatste > 10 * 60 * 1000) {
      localStorage.setItem('ksv.herstel', String(Date.now()))
      herstel()
    }
  }
}

export function startUpdates() {
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      wacht = true
      meld()
      probeer()
    },
    onRegisteredSW(_url, reg) {
      registratie = reg || null
      if (reg) setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000)
    },
  })
  setInterval(probeer, 5000)
  setInterval(controleer, 2 * 60 * 1000)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && controleer())
  controleer()
  // Android/Chrome: remember the install prompt so we can offer an "Installeren" button
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    window.__installPrompt = e
  })
}
