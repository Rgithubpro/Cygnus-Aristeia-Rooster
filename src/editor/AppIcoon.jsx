import { useEffect, useState } from 'react'
import { afbeeldingUrl } from '../config.js'
import BestandsKnop from '../BestandsKnop.jsx'
import { Schakel, Sectie, Seg } from './bouwstenen.jsx'
import { laadBitmap, voorbeeld } from './icoon.js'
import { txt } from '../t.js'

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
    if (bron) laadBitmap(bron).then((b) => !weg && setBmp(b)).catch(() => !weg && setFout(txt('De afbeelding kon niet worden geladen.')))
    return () => {
      weg = true
    }
  }, [bron])
  useEffect(() => {
    if (bmp) setPlaatjes({ any: voorbeeld(bmp, 256, icoon, false), mask: voorbeeld(bmp, 256, icoon, true) })
  }, [bmp, icoon.marge, icoon.achtergrond, icoon.modus, icoon.zoom, icoon.dx, icoon.dy])

  const kader = (naam, src, klas) => (
    <figure className="icoon-kader" key={naam}>
      <div className={`icoon-doos ${klas}`}>
        {src ? <img src={src} alt="" /> : <span className="note">…</span>}
        {zone && (klas === 'rond' || klas === 'afgerond') && <i className="veilig" />}
      </div>
      <figcaption className="note">{naam}</figcaption>
    </figure>
  )

  return (
    <Sectie titel={txt('App-icoon')} uitleg={txt('Dit staat op het beginscherm van de telefoon. We maken er automatisch PNG-bestanden van die op iPhone en Android werken. Installeer de app pas nadat dit klaar is.')}>
      <Seg label={txt('Bron')} waarde={icoon.bron} opties={[['logo', 'Gebruik mijn logo'], ['eigen', 'Eigen afbeelding']]} onKies={(v) => zetIcoon({ bron: v })} />
      {icoon.bron === 'eigen' && <BestandsKnop bestand={icoon.bestand} onBestand={(f) => zetIcoon({ bestand: f })} label={txt('Kies icoon-afbeelding')} />}
      {!bron && <p className="waarschuwing">{icoon.bron === 'eigen' ? txt('Kies eerst een afbeelding.') : txt('Je hebt nog geen logo. Voeg er een toe (tab Identiteit) of kies een eigen afbeelding.')}</p>}
      <Seg label={txt('Hoe komt de afbeelding in het icoon?')} waarde={icoon.modus} opties={[['passend', 'Past erin (met ruimte)'], ['vullend', 'Vult het hele icoon']]} onKies={(v) => zetIcoon({ modus: v })} />
      {icoon.modus === 'passend' && (
        <label className="veld">
          <span>{txt('Ruimte rond het icoon:')} {icoon.marge}%</span>
          <input type="range" min="0" max="30" value={icoon.marge} onChange={(e) => zetIcoon({ marge: Number(e.target.value) })} />
          <small className="note">{txt('Telefoons snijden de hoeken af. Met wat ruimte blijft alles zichtbaar.')}</small>
        </label>
      )}
      <label className="veld">
        <span>{txt('Zoom:')} {icoon.zoom}%</span>
        <input type="range" min="50" max="300" value={icoon.zoom} onChange={(e) => zetIcoon({ zoom: Number(e.target.value) })} />
      </label>
      <label className="veld">
        <span>{txt('Verschuiven naar rechts of links:')} {icoon.dx}%</span>
        <input type="range" min="-50" max="50" value={icoon.dx} onChange={(e) => zetIcoon({ dx: Number(e.target.value) })} />
      </label>
      <label className="veld">
        <span>{txt('Verschuiven omhoog of omlaag:')} {icoon.dy}%</span>
        <input type="range" min="-50" max="50" value={icoon.dy} onChange={(e) => zetIcoon({ dy: Number(e.target.value) })} />
      </label>
      <label className="veld kleurveld">
        <span>{txt('Achtergrondkleur van het icoon')}</span>
        <input type="color" value={icoon.achtergrond} onChange={(e) => zetIcoon({ achtergrond: e.target.value })} />
      </label>
      <Schakel label={txt('Toon de veilige zone (stippellijn)')} aan={zone} onWissel={setZone} />
      {fout && <p className="fout">{fout}</p>}
      <div className="icoon-rij">
        {kader('iPhone', plaatjes.any, 'ios')}
        {kader(txt('Android (rond)'), plaatjes.mask, 'rond')}
        {kader(txt('Android (afgerond)'), plaatjes.mask, 'afgerond')}
        <figure className="icoon-kader">
          <div className="tab-mock">
            {plaatjes.any ? <img src={plaatjes.any} alt="" /> : <span className="note">…</span>}
            <span>{txt('Aristeia')}</span>
          </div>
          <figcaption className="note">{txt('Browser-tab')}</figcaption>
        </figure>
      </div>
      {icoon.actief ? <p className="note">{txt('Het nieuwe icoon wordt gemaakt als je op Opslaan drukt.')}</p> : t.icoon && <p className="note">{txt('Huidig app-icoon:')} <img className="icoon-nu" crossOrigin="anonymous" src={afbeeldingUrl(t.icoon)} alt="" /></p>}
    </Sectie>
  )
}
