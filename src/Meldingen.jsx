import { useEffect, useState } from 'react'
import { nl } from './strings.js'
import { pushVersturen } from './api.js'
import { isIos, meldingenStatus, pushOndersteund, zetMeldingenAan, zetMeldingenUit } from './push.js'
import Modal from './Modal.jsx'
import { pushGeconfigureerd } from './config.js'

export default function Meldingen({ sessie, leerlingId, onSluit }) {
  const [status, setStatus] = useState(null) // null = still checking
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')
  const [test, setTest] = useState('')

  const ververs = () => meldingenStatus(sessie.token, leerlingId).then(setStatus)
  useEffect(() => {
    let weg = false
    meldingenStatus(sessie.token, leerlingId).then((s) => !weg && setStatus(s))
    return () => {
      weg = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function aan() {
    setBezig(true)
    setFout('')
    try {
      const ok = await zetMeldingenAan(sessie.token)
      if (!ok) setFout(nl.meldingenGeweigerd)
    } catch {
      setFout(nl.laadFout)
    }
    await ververs()
    setBezig(false)
  }

  async function uit() {
    setBezig(true)
    await zetMeldingenUit(sessie.token).catch(() => {})
    await ververs()
    setBezig(false)
  }

  async function testMelding() {
    setBezig(true)
    setTest('')
    try {
      const r = await pushVersturen({ actie: 'test', token: sessie.token })
      if (r.apparaten === 0) setTest(nl.testGeenApparaat)
      else if (r.verstuurd > 0) setTest(`${nl.testVerstuurd} (${r.verstuurd}/${r.apparaten})`)
      else setTest(`${nl.testMislukt} ${Object.keys(r.fouten || {}).join(', ')}`)
    } catch (e) {
      setTest(`${nl.testFout} (${e.message})`)
    }
    setBezig(false)
  }

  let inhoud
  if (!pushGeconfigureerd()) {
    inhoud = <p className="note">{nl.meldingenNietBeschikbaar}</p>
  } else if (!pushOndersteund()) {
    inhoud = (
      <div className="stack">
        <strong>{nl.installeerTitel}</strong>
        <p>{nl.installeerUitleg}</p>
        <p className="note">{isIos() ? nl.installeerIos : nl.installeerAndroid}</p>
      </div>
    )
  } else if (!leerlingId) {
    inhoud = <p className="note">{nl.meldingenKiesNaam}</p>
  } else if (!status) {
    inhoud = <p className="note">{nl.laden}</p>
  } else if (status.toegestaan === 'denied') {
    inhoud = <p className="fout">{nl.meldingenGeweigerd}</p>
  } else if (status.aan) {
    inhoud = (
      <>
        <p className="ok">✓ {nl.meldingenAan}</p>
        <button className="btn" disabled={bezig} onClick={testMelding}>
          {nl.testMelding}
        </button>
        {test && (
          <p className="note" role="status">
            {test}
          </p>
        )}
        <button className="btn danger" disabled={bezig} onClick={uit}>
          {nl.meldingenZetUit}
        </button>
      </>
    )
  } else {
    inhoud = (
      <button className="btn" disabled={bezig} onClick={aan}>
        {nl.meldingenZetAan}
      </button>
    )
  }

  return (
    <Modal titel={`🔔 ${nl.meldingenTitel}`} onSluit={onSluit}>
      <p>{nl.meldingenUitleg}</p>
      {inhoud}
      {fout && <p className="fout">{fout}</p>}
    </Modal>
  )
}
