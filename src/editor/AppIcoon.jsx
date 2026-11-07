import { useEffect, useState } from 'react'
import { afbeeldingUrl } from '../config.js'
import BestandsKnop from '../BestandsKnop.jsx'
import { Schakel, Sectie, Seg } from './bouwstenen.jsx'
import { laadBitmap, voorbeeld } from './icoon.js'

// The icon on the phone's home screen. Made from the class logo or an own picture, with space around it, as PNG files.
export default function AppIcoon({ t, bestandLogo, icoon, zetIcoon }) {
  const [bmp, setBmp] = useState(null)
  const [fout, setFout] = useState('')
  const [zone, setZone] = useState(true)
  const [plaatjes, setPlaatjes] = useState({ any: '', mask: '' })
  const bron = icoon.bron === 'eigen' ? icoon.bestand : bestandLogo || (t.logo ? afbeeldingUrl(t.logo) : null)

  useEffect(() => {
    let weg = false
    setBmp(null)
    setFout('')
    if (bron) laadBitmap(bron).then((b) => !weg && setBmp(b)).catch(() => !weg && setFout('De afbeelding kon niet worden geladen.'))
    return () => {
      weg = true
    }
  }, [bron])
  useEffect(() => {
    if (bmp) setPlaatjes({ any: voorbeeld(bmp, 256, icoon, false), mask: voorbeeld(bmp, 256, icoon, true) })
  }, [bmp, icoon.marge, icoon.achtergrond])

  const kader = (naam, src, klas) => (
    <figure className="icoon-kader" key={naam}>
      <div className={`icoon-doos ${klas}`}>
        {src ? <img src={src} alt="" /> : <span className="note">…</span>}
        {zone && klas !== 'tab' && <i className="veilig" />}
      </div>
      <figcaption className="note">{naam}</figcaption>
    </figure>
  )

  return (
    <Sectie titel="App-icoon" uitleg="Dit staat op het beginscherm van de telefoon. We maken er automatisch PNG-bestanden van die op iPhone en Android werken. Installeer de app pas nadat dit klaar is.">
      <Seg label="Bron" waarde={icoon.bron} opties={[['logo', 'Gebruik mijn logo'], ['eigen', 'Eigen afbeelding']]} onKies={(v) => zetIcoon({ bron: v })} />
      {icoon.bron === 'eigen' && <BestandsKnop bestand={icoon.bestand} onBestand={(f) => zetIcoon({ bestand: f })} label="Kies icoon-afbeelding" />}
      {!bron && <p className="waarschuwing">{icoon.bron === 'eigen' ? 'Kies eerst een afbeelding.' : 'Je hebt nog geen logo. Voeg er een toe (tab Identiteit) of kies een eigen afbeelding.'}</p>}
      <label className="veld">
        <span>Ruimte rond het icoon: {icoon.marge}%</span>
        <input type="range" min="0" max="30" value={icoon.marge} onChange={(e) => zetIcoon({ marge: Number(e.target.value) })} />
        <small className="note">Telefoons snijden de hoeken af. Met wat ruimte blijft alles zichtbaar.</small>
      </label>
      <label className="veld kleurveld">
        <span>Achtergrondkleur van het icoon</span>
        <input type="color" value={icoon.achtergrond} onChange={(e) => zetIcoon({ achtergrond: e.target.value })} />
      </label>
      <Schakel label="Toon de veilige zone (stippellijn)" aan={zone} onWissel={setZone} />
      {fout && <p className="fout">{fout}</p>}
      <div className="icoon-rij">
        {kader('iPhone', plaatjes.any, 'ios')}
        {kader('Android (rond)', plaatjes.mask, 'rond')}
        {kader('Android (afgerond)', plaatjes.mask, 'afgerond')}
        {kader('Browser-tab', plaatjes.any, 'tab')}
      </div>
      {icoon.actief ? <p className="note">Het nieuwe icoon wordt gemaakt als je op Opslaan drukt.</p> : t.icoon && <p className="note">Huidig app-icoon: <img className="icoon-nu" crossOrigin="anonymous" src={afbeeldingUrl(t.icoon)} alt="" /></p>}
    </Sectie>
  )
}
