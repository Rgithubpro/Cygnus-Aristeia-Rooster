import { rpc } from './api.js'
import { useData } from './data.jsx'
import { uploadKlasAfbeelding, verwijderKlasAfbeelding } from './upload.js'
import KlasThemaForm from './KlasThemaForm.jsx'

export default function BeheerKlas({ sessie }) {
  const { data, ververs } = useData()
  return (
    <KlasThemaForm
      key={data.klas.id}
      klas={data.klas}
      opslaan={async (naam, thema) => {
        await rpc('klas_thema_opslaan', { p_token: sessie.token, p_weergavenaam: naam, p_thema: thema })
        await ververs()
      }}
      upload={(bestand, maxPx) => uploadKlasAfbeelding(sessie, bestand, maxPx)}
      verwijder={(pad) => verwijderKlasAfbeelding(sessie, pad)}
    />
  )
}
