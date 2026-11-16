import { useEffect, useState } from 'react'

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() || ''
const CONSENT_KEY = `ksv.analytics_consent.${MEASUREMENT_ID || 'unconfigured'}`
const CONSENT_EVENT = 'ks-analytics-consent'
const TRACKABLE_TABS = new Set(['rooster', 'info', 'stand', 'pagina', 'beheer'])
const TRACKABLE_ADMIN_PAGES = new Set(['activiteiten', 'leerlingen', 'dagberichten', 'info', 'meldingen', 'klas'])

let scriptRequested = false
let laatstePaginaweergave = ''
let laatstePaginaweergaveTijd = 0

function isDubbelePaginaweergave(sleutel) {
  const nu = Date.now()
  if (laatstePaginaweergave === sleutel && nu - laatstePaginaweergaveTijd < 1000) return true
  laatstePaginaweergave = sleutel
  laatstePaginaweergaveTijd = nu
  return false
}

export function analyticsConfigured() {
  return /^G-[A-Z0-9]+$/.test(MEASUREMENT_ID)
}

export function leesAnalyticsToestemming() {
  try {
    const keuze = localStorage.getItem(CONSENT_KEY)
    return keuze === 'granted' || keuze === 'denied' ? keuze : null
  } catch {
    return null
  }
}

export function zetAnalyticsToestemming(keuze) {
  if (keuze !== 'granted' && keuze !== 'denied') return false

  try {
    localStorage.setItem(CONSENT_KEY, keuze)
  } catch {
    return false
  }

  if (keuze === 'denied') {
    stopAnalytics()
  } else if (analyticsConfigured()) {
    window[`ga-disable-${MEASUREMENT_ID}`] = false
  }

  window.dispatchEvent(new Event(CONSENT_EVENT))
  return true
}

export function useAnalyticsToestemming() {
  const [keuze, setKeuze] = useState(leesAnalyticsToestemming)

  useEffect(() => {
    const bijwerken = () => setKeuze(leesAnalyticsToestemming())
    window.addEventListener(CONSENT_EVENT, bijwerken)
    window.addEventListener('storage', bijwerken)
    return () => {
      window.removeEventListener(CONSENT_EVENT, bijwerken)
      window.removeEventListener('storage', bijwerken)
    }
  }, [])

  return keuze
}

export function startAnalytics() {
  if (!analyticsConfigured() || leesAnalyticsToestemming() !== 'granted') return false

  window[`ga-disable-${MEASUREMENT_ID}`] = false
  if (scriptRequested) return true

  window.dataLayer = window.dataLayer || []
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', MEASUREMENT_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`
  script.dataset.aristeiaAnalytics = 'true'
  script.onerror = () => {
    console.error('Google Analytics kon niet worden geladen.')
    scriptRequested = false
    script.remove()
  }
  scriptRequested = true
  document.head.appendChild(script)
  return true
}

export function stopAnalytics() {
  if (!analyticsConfigured()) return
  window[`ga-disable-${MEASUREMENT_ID}`] = true
}

function geldigeKlasSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9-]{1,40}$/.test(slug) ? slug : null
}

function analyticsRol(rol) {
  return rol === 'beheer' ? 'beheerder' : rol === 'leerling' ? 'leerling' : null
}

function basisPaginaData(klasSlug, rol) {
  const klas = geldigeKlasSlug(klasSlug)
  const userRole = analyticsRol(rol)
  return klas && userRole ? { class_slug: klas, user_role: userRole } : null
}

export function stuurPaginaweergave(tab, klasSlug, rol) {
  if (!TRACKABLE_TABS.has(tab) || !startAnalytics()) return

  const basis = basisPaginaData(klasSlug, rol)
  if (!basis) return

  const pad = `/app/${tab}`
  if (isDubbelePaginaweergave(`page_view:${basis.class_slug}:${basis.user_role}:${tab}`)) return

  window.gtag('event', 'page_view', {
    page_title: `Aristeia | ${tab}`,
    page_location: `${window.location.origin}${pad}`,
    page_path: pad,
    page_referrer: '',
    ...basis,
  })
}

export function stuurBeheerPagina(klasSlug, pagina) {
  if (!TRACKABLE_ADMIN_PAGES.has(pagina) || !startAnalytics()) return

  const basis = basisPaginaData(klasSlug, 'beheer')
  if (!basis) return
  if (isDubbelePaginaweergave(`admin_page_view:${basis.class_slug}:${pagina}`)) return

  window.gtag('event', 'admin_page_view', {
    admin_page: pagina,
    ...basis,
  })
}
