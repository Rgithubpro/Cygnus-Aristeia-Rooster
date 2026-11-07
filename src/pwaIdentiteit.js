import { useEffect } from 'react'
import { afbeeldingUrl } from './config.js'

// Gives the installed app the class identity: name, PNG icon set and colour (best effort; falls back to the default app).
// Install the app AFTER opening your class link, so the phone picks up this icon and name.
export function useAppIdentiteit(naam, slug, thema) {
  const icoon512 = thema?.icoon || ''
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
    const basis = icoon512 ? afbeeldingUrl(icoon512.replace(/-512\.png$/, '')) : null
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
      icons: basis
        ? [
            { src: `${basis}-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: `${basis}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: `${basis}-m512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ]
        : [
            { src: `${origin}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
            { src: `${origin}/icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
          ],
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }))
    link.setAttribute('href', url)
    if (basis && apple) apple.setAttribute('href', `${basis}-180.png`)
    document.title = naam
    return () => {
      link.setAttribute('href', oudManifest || '/manifest.webmanifest')
      if (apple && oudApple) apple.setAttribute('href', oudApple)
      document.title = oudTitel
      URL.revokeObjectURL(url)
    }
  }, [naam, slug, icoon512, kleur])
}
