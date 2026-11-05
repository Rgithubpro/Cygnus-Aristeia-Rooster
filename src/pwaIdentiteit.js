import { useEffect } from 'react'
import { afbeeldingUrl } from './config.js'

// Gives the installed app the class identity: name, icon and colour (best effort; falls back to the default app).
// Install the app AFTER opening your class link, so the phone picks up this icon and name.
export function useAppIdentiteit(naam, slug, thema) {
  const logo = thema?.logo || ''
  const kleur = thema?.achtergrond || ''
  useEffect(() => {
    if (!slug || !naam) return
    const origin = location.origin
    let link = document.querySelector('link[rel="manifest"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'manifest'
      document.head.appendChild(link)
    }
    let apple = document.querySelector('link[rel="apple-touch-icon"]')
    const oudManifest = link.getAttribute('href')
    const oudApple = apple?.getAttribute('href')
    const oudTitel = document.title
    const icoon = logo ? afbeeldingUrl(logo) : null
    const manifest = {
      id: `${origin}/k/${slug}`,
      name: naam,
      short_name: naam.slice(0, 12),
      lang: 'nl',
      start_url: `${origin}/k/${slug}`,
      scope: `${origin}/`,
      display: 'standalone',
      background_color: kleur || '#eef1f7',
      theme_color: kleur || '#14203d',
      icons: icoon
        ? [{ src: icoon, sizes: '512x512', type: 'image/jpeg' }, { src: icoon, sizes: '192x192', type: 'image/jpeg' }]
        : [
            { src: `${origin}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
            { src: `${origin}/icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
          ],
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }))
    link.setAttribute('href', url)
    if (icoon && apple) apple.setAttribute('href', icoon)
    document.title = naam
    return () => {
      link.setAttribute('href', oudManifest || '/manifest.webmanifest')
      if (apple && oudApple) apple.setAttribute('href', oudApple)
      document.title = oudTitel
      URL.revokeObjectURL(url)
    }
  }, [naam, slug, logo, kleur])
}
