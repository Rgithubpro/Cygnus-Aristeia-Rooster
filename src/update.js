import { registerSW } from 'virtual:pwa-register'

// New app versions are applied automatically, but never while someone is typing or has a window open,
// so a deploy during the event cannot wipe a half-filled form. A small bar offers "Nu vernieuwen" meanwhile.
let wacht = false
let updateSW = () => {}
const luisteraars = new Set()

export const bijUpdate = (fn) => {
  luisteraars.add(fn)
  fn(wacht)
  return () => luisteraars.delete(fn)
}
const meld = () => luisteraars.forEach((f) => f(wacht))

const bezigMetTypen = () => {
  const el = document.activeElement
  return !!el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

export function pasToe() {
  wacht = false
  meld()
  updateSW(true)
}

function probeer() {
  if (wacht && !bezigMetTypen() && !document.querySelector('.modal')) pasToe()
}

export function startUpdates() {
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      wacht = true
      meld()
      probeer()
    },
    // long-lived installed apps check for a new version every 30 minutes
    onRegisteredSW(_url, registratie) {
      if (registratie) setInterval(() => registratie.update().catch(() => {}), 30 * 60 * 1000)
    },
  })
  setInterval(probeer, 5000)
}
