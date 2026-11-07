import Mark from './Mark.jsx'
import { nl } from './strings.js'
import { afbeeldingSrc, toonVan } from './themaModel.js'

// Page header: class logo (or the Cygnus swan), name, slogan, optional banner image. All of it is customizable.
export default function Kop({ klas, thema = {}, onUitloggen }) {
  const toon = toonVan(thema)
  const stijl = thema.kop_stijl || 'compact'
  const uitlijning = thema.kop_uitlijning || 'links'
  const logo = toon.logo ? afbeeldingSrc(thema, 'logo') : null
  const banner = stijl === 'banner' ? afbeeldingSrc(thema, 'banner') : null
  const groot = stijl !== 'compact'
  const grootte = groot ? 72 : 44

  const naam = klas ? thema._naam ?? (klas.weergavenaam || klas.naam) : nl.title
  const sub = toon.slogan && thema.slogan ? thema.slogan : klas && toon.appnaam ? nl.title : klas ? '' : nl.tagline

  let beeld = null
  if (toon.logo) {
    if (logo) beeld = <img crossOrigin="anonymous" className="klas-logo" style={{ width: grootte, height: grootte }} src={logo} alt="" />
    else if (thema.emoji) beeld = <span className="klas-emoji" style={{ fontSize: groot ? '3rem' : '2rem', width: grootte }} aria-hidden="true">{thema.emoji}</span>
    else beeld = <Mark size={grootte} />
  }

  return (
    <header className={`head kop-${stijl} uitlijn-${uitlijning}`} style={banner ? { backgroundImage: `url("${banner}")` } : undefined}>
      {beeld}
      <div className="grow">
        <h1>{naam}</h1>
        {sub && <p className="tagline">{sub}</p>}
      </div>
      {onUitloggen && (
        <button className="btn ghost klein" onClick={onUitloggen}>
          {nl.uitloggen}
        </button>
      )}
    </header>
  )
}
