import { rpc } from './api.js'
import { useData } from './data.jsx'
import { uploadKlasAfbeelding, verwijderKlasAfbeelding } from './upload.js'
import KlasEditor from './editor/KlasEditor.jsx'

// Class admins can customize everything about their class here.
export default function BeheerKlas({ sessie }) {
  const { data, ververs } = useData()
  return (
    <KlasEditor
      klas={data.klas}
      opslaanThema={async (naam, thema) => {
        await rpc('klas_thema_opslaan', { p_token: sessie.token, p_weergavenaam: naam, p_thema: thema })
        await ververs()
      }}
      opslaanPagina={async (blokken) => {
        await rpc('klas_pagina_opslaan', { p_token: sessie.token, p_pagina: blokken })
        await ververs()
      }}
      paginaLaad={() => rpc('pagina_ophalen', { p_token: sessie.token })}
      upload={(bestand, maxPx) => uploadKlasAfbeelding(sessie, bestand, maxPx)}
      verwijder={(pad) => verwijderKlasAfbeelding(sessie, pad)}
    />
  )
}
