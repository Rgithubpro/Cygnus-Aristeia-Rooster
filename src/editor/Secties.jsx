import { useEffect, useMemo } from 'react'
import { afbeeldingUrl } from '../config.js'
import BestandsKnop from '../BestandsKnop.jsx'
import EmojiKiezer from '../EmojiKiezer.jsx'
import { FONTS, PALETTEN, PATRONEN, PRESET_KLEUREN, TAB_STANDAARD, contrast, tabsVan, toonVan } from '../themaModel.js'
import EmojiLijst from './EmojiLijst.jsx'
import { Kiezen, Schakel, Sectie, Seg } from './bouwstenen.jsx'
import { txt } from '../t.js'

function BeeldKeuze({ label, uitleg, pad, bestand, onBestand, onWeg }) {
  const lokaal = useMemo(() => (bestand ? URL.createObjectURL(bestand) : null), [bestand])
  useEffect(() => () => lokaal && URL.revokeObjectURL(lokaal), [lokaal])
  const src = lokaal || (pad ? afbeeldingUrl(pad) : null)
  return (
    <div className="veld">
      <span>{label}</span>
      <BestandsKnop onBestand={onBestand} bestand={bestand} />
      {uitleg && <small className="note">{uitleg}</small>}
      {src && (
        <div className="rij">
          <img className="qr-klein" src={src} alt="" />
          <button type="button" className="btn danger klein" onClick={onWeg}>
            {txt('Weghalen')}
          </button>
        </div>
      )}
    </div>
  )
}

export function Identiteit({ t, zet, naam, setNaam, bestanden, zetBestand }) {
  const toon = toonVan(t)
  const zetToon = (k, v) => zet({ toon: { ...(t.toon || {}), [k]: v } })
  return (
    <>
      <Sectie titel={txt('Naam en slogan')}>
        <label className="veld">
          <span>{txt('Bijnaam van je klas')}</span>
          <input value={naam} onChange={(e) => setNaam(e.target.value)} maxLength={40} placeholder={txt('Bijvoorbeeld: 4G1 De Draken')} />
          <small className="note">{txt('Alleen je eigen klas ziet deze naam. Iedereen anders (inlogscherm, stand) ziet de gewone klasnaam.')}</small>
        </label>
        <label className="veld">
          <span>{txt('Slogan')}</span>
          <input value={t.slogan || ''} onChange={(e) => zet({ slogan: e.target.value })} maxLength={60} placeholder={txt('Samen sterk!')} />
        </label>
        <EmojiKiezer label={txt('Klas-emoji (als je geen logo hebt)')} waarde={t.emoji || ''} onKies={(emoji) => zet({ emoji })} auto />
      </Sectie>

      <Sectie titel={txt('Afbeeldingen')} uitleg={txt('Alles wordt automatisch verkleind. Je logo vervangt het zwaan-logo in de app en in meldingen. Het app-icoon voor het beginscherm stel je in bij de tab App-icoon.')}>
        <BeeldKeuze label={txt('Logo (vierkant werkt het best)')} pad={t.logo} bestand={bestanden.logo} onBestand={(f) => zetBestand('logo', f)} onWeg={() => { zetBestand('logo', null); zet({ logo: '' }) }} />
        <BeeldKeuze label={txt('Banner (brede afbeelding achter de kop)')} uitleg={txt('Alleen zichtbaar bij kop-stijl \'Banner\' (tab Stijl).')} pad={t.banner} bestand={bestanden.banner} onBestand={(f) => zetBestand('banner', f)} onWeg={() => { zetBestand('banner', null); zet({ banner: '' }) }} />
        <BeeldKeuze label={txt('Mascotte (zweeft in een hoek van het scherm)')} pad={t.mascotte} bestand={bestanden.mascotte} onBestand={(f) => zetBestand('mascotte', f)} onWeg={() => { zetBestand('mascotte', null); zet({ mascotte: '' }) }} />
        <Seg label={txt('Mascotte staat')} waarde={t.mascotte_positie || 'rechtsonder'} opties={[['rechtsonder', 'Rechtsonder'], ['linksonder', 'Linksonder'], ['uit', 'Uit']]} onKies={(v) => zet({ mascotte_positie: v })} />
      </Sectie>

      <Sectie titel={txt('Kop')}>
        <Schakel label={txt('Logo tonen')} aan={toon.logo} onWissel={(v) => zetToon('logo', v)} />
        <Schakel label={txt('Slogan tonen')} aan={toon.slogan} onWissel={(v) => zetToon('slogan', v)} />
        <Schakel label={txt('Naam van de app (Aristeia) tonen')} aan={toon.appnaam} onWissel={(v) => zetToon('appnaam', v)} />
      </Sectie>
    </>
  )
}

export function leesbaarheid(t) {
  if (t.palet !== 'eigen') return { ok: true, ratio: 21 }
  const bg = t.achtergrond || '#eef1f7'
  const kaart = t.kaart || '#ffffff'
  const tekst = t.tekst || '#14203d'
  const ratio = Math.min(contrast(tekst, bg), contrast(tekst, kaart))
  return { ok: ratio >= 3, ratio }
}

export function Kleuren({ t, zet }) {
  const palet = t.palet || 'standaard'
  const l = leesbaarheid(t)
  const kleurVeld = (sleutel, label, standaard) => (
    <label className="veld kleurveld" key={sleutel}>
      <span>{label}</span>
      <input type="color" value={t[sleutel] || standaard} onChange={(e) => zet({ [sleutel]: e.target.value })} />
    </label>
  )
  return (
    <>
      <Sectie titel={txt('Licht of donker')} uitleg={txt('Automatisch volgt de stand van de telefoon.')}>
        <Seg label={txt('Modus')} waarde={t.modus || 'auto'} opties={[['auto', 'Automatisch'], ['licht', 'Licht'], ['donker', 'Donker']]} onKies={(v) => zet({ modus: v })} />
      </Sectie>

      <Sectie titel={txt('Kleurenpalet')} uitleg={txt('Kies een complete stijl, of stel hem helemaal zelf samen.')}>
        <div className="paletten">
          {Object.entries(PALETTEN).map(([id, p]) => {
            const kl = p.licht || null
            return (
              <button type="button" key={id} className={`palet${palet === id ? ' gekozen' : ''}`} onClick={() => zet({ palet: id })} aria-pressed={palet === id}>
                <span className="dots">
                  {kl ? [kl.bg, kl.kaart, kl.accent, kl.accent2].map((c, i) => <i key={i} style={{ background: c }} />) : id === 'standaard' ? PRESET_KLEUREN.slice(0, 4).map((c, i) => <i key={i} style={{ background: c }} />) : ['#ff5d5d', '#ffd24d', '#4dd66a', '#4d9aff'].map((c, i) => <i key={i} style={{ background: c }} />)}
                </span>
                {p.label}
              </button>
            )
          })}
        </div>
      </Sectie>

      {palet === 'standaard' && (
        <Sectie titel={txt('Hoofdkleur')} uitleg={txt('Voor knoppen, tabbladen en accenten.')}>
          <div className="kleuren">
            {PRESET_KLEUREN.map((k) => (
              <button type="button" key={k} className={`kleur${(t.accent || '').toLowerCase() === k ? ' gekozen' : ''}`} style={{ background: k }} aria-label={k} onClick={() => zet({ accent: k })} />
            ))}
            <input type="color" value={t.accent || '#2f56d9'} onChange={(e) => zet({ accent: e.target.value })} aria-label={txt('Eigen kleur')} />
            <button type="button" className="btn ghost klein" onClick={() => zet({ accent: '' })}>{txt('Standaard')}</button>
          </div>
        </Sectie>
      )}

      {palet === 'eigen' && (
        <Sectie titel={txt('Jouw kleuren')} uitleg={txt('De app kiest zelf de tekstkleur op knoppen en zorgt dat je accentkleuren leesbaar blijven.')}>
          <div className="kleurvelden">
            {kleurVeld('achtergrond', txt('Achtergrond'), '#eef1f7')}
            {kleurVeld('kaart', txt('Kaarten'), '#ffffff')}
            {kleurVeld('tekst', txt('Tekst'), '#14203d')}
            {kleurVeld('accent', txt('Hoofdkleur'), '#2f56d9')}
            {kleurVeld('accent2', txt('Tweede kleur'), '#d6336c')}
          </div>
          {!l.ok && <p className="fout">{txt('Deze tekstkleur is slecht leesbaar op je achtergrond (contrast')} {l.ratio.toFixed(1)}{txt(':1, minimaal 3:1). Kies een lichtere of donkerdere tekstkleur.')}</p>}
          {l.ok && l.ratio < 4.5 && <p className="waarschuwing">{txt('Let op: de tekst is redelijk leesbaar (contrast')} {l.ratio.toFixed(1)}{txt(':1), maar voor kleine letters is 4.5:1 beter.')}</p>}
        </Sectie>
      )}
    </>
  )
}

const fontOpties = Object.entries(FONTS).map(([k, v]) => [k, v.label])

export function Stijl({ t, zet }) {
  return (
    <>
      <Sectie titel={txt('Letters')}>
        <Kiezen label={txt('Lettertype koppen')} waarde={t.font_kop || 'klassiek'} opties={fontOpties} onKies={(v) => zet({ font_kop: v })} />
        <Kiezen label={txt('Lettertype tekst')} waarde={t.font_tekst || 'systeem'} opties={fontOpties} onKies={(v) => zet({ font_tekst: v })} />
        <Seg label={txt('Tekstgrootte')} waarde={t.tekstgrootte || 'normaal'} opties={[['klein', 'Klein'], ['normaal', 'Normaal'], ['groot', 'Groot']]} onKies={(v) => zet({ tekstgrootte: v })} />
      </Sectie>
      <Sectie titel={txt('Vormen en ruimte')}>
        <Seg label={txt('Hoeken')} waarde={t.hoeken || 'normaal'} opties={[['scherp', 'Scherp'], ['normaal', 'Normaal'], ['rond', 'Rond'], ['extra', 'Extra rond']]} onKies={(v) => zet({ hoeken: v })} />
        <Seg label={txt('Ruimte')} waarde={t.dichtheid || 'normaal'} opties={[['compact', 'Compact'], ['normaal', 'Normaal'], ['ruim', 'Ruim']]} onKies={(v) => zet({ dichtheid: v })} />
      </Sectie>
      <Sectie titel={txt('Kop en rooster')}>
        <Seg label={txt('Kop-stijl')} waarde={t.kop_stijl || 'compact'} opties={[['compact', 'Compact'], ['groot', 'Groot'], ['banner', 'Banner']]} onKies={(v) => zet({ kop_stijl: v })} />
        <Seg label={txt('Uitlijning kop')} waarde={t.kop_uitlijning || 'links'} opties={[['links', 'Links'], ['midden', 'Midden']]} onKies={(v) => zet({ kop_uitlijning: v })} />
        <Seg label={txt('Roosterkaarten')} waarde={t.kaartstijl || 'kaart'} opties={[['kaart', 'Kaarten'], ['lijst', 'Lijst'], ['tijdlijn', 'Tijdlijn'], ['compact', 'Compact']]} onKies={(v) => zet({ kaartstijl: v })} />
      </Sectie>
    </>
  )
}

export function Weergave({ t, zet }) {
  const toon = toonVan(t)
  const zetToon = (k, v) => zet({ toon: { ...(t.toon || {}), [k]: v } })
  return (
    <>
      <Sectie titel={txt('Wat laat je zien op een rooster-kaart?')}>
        <Schakel label={txt('Emoji bij de activiteit')} aan={toon.emoji} onWissel={(v) => zetToon('emoji', v)} />
        <Schakel label={txt('Locatie')} aan={toon.locatie} onWissel={(v) => zetToon('locatie', v)} />
        <Schakel label={txt('Omschrijving')} aan={toon.omschrijving} onWissel={(v) => zetToon('omschrijving', v)} />
        <Schakel label={txt('Met wie (deelnemers)')} aan={toon.voor} onWissel={(v) => zetToon('voor', v)} />
        <Schakel label={txt('Eindtijd')} aan={toon.einde} onWissel={(v) => zetToon('einde', v)} />
        <Schakel label={txt('\'Nu bezig\'-markering')} aan={toon.nu} onWissel={(v) => zetToon('nu', v)} />
      </Sectie>
      <Sectie titel={txt('Teksten en start')}>
        <label className="veld">
          <span>{txt('Tekst bij de huidige activiteit')}</span>
          <input value={t.nu_label || ''} onChange={(e) => zet({ nu_label: e.target.value })} maxLength={20} placeholder={txt('Nu bezig')} />
        </label>
        <Seg label={txt('Rooster opent met')} waarde={t.standaard_weergave || 'mijn'} opties={[['mijn', 'Mijn rooster'], ['klas', 'Hele klas']]} onKies={(v) => zet({ standaard_weergave: v })} />
      </Sectie>
    </>
  )
}

export function Decoratie({ t, zet }) {
  const patroon = t.patroon || 'geen'
  return (
    <>
      <Sectie titel={txt('Achtergrondpatroon')} uitleg={txt('In de kleuren van je klas.')}>
        <div className="paletten">
          {PATRONEN.map((p) => (
            <button type="button" key={p} className={`palet${patroon === p ? ' gekozen' : ''}`} onClick={() => zet({ patroon: p })} aria-pressed={patroon === p}>
              {p === 'geen' ? txt('Geen') : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        {patroon !== 'geen' && <Seg label={txt('Sterkte')} waarde={t.patroon_sterkte || 'midden'} opties={[['zacht', 'Zacht'], ['midden', 'Midden'], ['sterk', 'Sterk']]} onKies={(v) => zet({ patroon_sterkte: v })} />}
      </Sectie>
      <Sectie titel={txt('Emoji-decoratie')} uitleg={txt('Kies tot 5 emoji. Ze worden gebruikt voor de strook onder de kop en de emoji-regen.')}>
        <EmojiLijst label={txt('Jouw emoji')} waarde={t.emojis || []} onWijzig={(emojis) => zet({ emojis })} />
        <Schakel label={txt('Emoji-strook onder de kop')} aan={t.emoji_strook} onWissel={(v) => zet({ emoji_strook: v })} />
        <Seg label={txt('Emoji-regen (valt rustig over het scherm)')} waarde={t.emoji_regen || 'uit'} opties={[['uit', 'Uit'], ['zacht', 'Zacht'], ['veel', 'Veel']]} onKies={(v) => zet({ emoji_regen: v })} />
        <small className="note">{txt('De regen verdwijnt vanzelf voor mensen die in hun telefoon \'minder beweging\' hebben gekozen.')}</small>
      </Sectie>
    </>
  )
}

export function Tabs({ t, zet }) {
  const volgorde = tabsVolgorde(t)
  const cfg = (id) => t.tabs?.[id] || {}
  const zetTab = (id, patch) => zet({ tabs: { ...(t.tabs || {}), [id]: { ...cfg(id), ...patch } } })
  const verplaats = (i, d) => {
    const n = [...volgorde]
    const j = i + d
    if (j < 0 || j >= n.length) return
    ;[n[i], n[j]] = [n[j], n[i]]
    zet({ tab_volgorde: n })
  }
  const actief = tabsVan(t).map(([id, label]) => [id, label])
  return (
    <>
      <Sectie titel={txt('Tabbladen')} uitleg={txt('Zet tabbladen aan of uit, geef ze een eigen naam en kies de volgorde. \'Onze klas\' is je eigen pagina (zie tab Klaspagina) en staat standaard uit.')}>
        {volgorde.map((id, i) => (
          <div key={id} className="tab-rij">
            <div className="rij">
              <button type="button" className="btn ghost klein" onClick={() => verplaats(i, -1)} disabled={i === 0} aria-label={txt('Omhoog')}>↑</button>
              <button type="button" className="btn ghost klein" onClick={() => verplaats(i, 1)} disabled={i === volgorde.length - 1} aria-label={txt('Omlaag')}>↓</button>
              <Schakel label={TAB_STANDAARD[id]} aan={id === 'rooster' ? true : cfg(id).aan ?? id !== 'pagina'} uit={id === 'rooster'} onWissel={(v) => zetTab(id, { aan: v })} />
            </div>
            <input value={cfg(id).naam || ''} onChange={(e) => zetTab(id, { naam: e.target.value })} maxLength={14} placeholder={TAB_STANDAARD[id]} aria-label={txt('Naam van {x1}', { x1: TAB_STANDAARD[id] })} />
          </div>
        ))}
      </Sectie>
      <Sectie titel={txt('Startscherm')}>
        <Kiezen label={txt('App opent op')} waarde={t.start_tab && actief.some(([id]) => id === t.start_tab) ? t.start_tab : actief[0][0]} opties={actief} onKies={(v) => zet({ start_tab: v })} />
      </Sectie>
    </>
  )
}

export const tabsVolgorde = (t) => [...(t.tab_volgorde || []), 'rooster', 'info', 'stand', 'pagina'].filter((id, i, a) => a.indexOf(id) === i)
