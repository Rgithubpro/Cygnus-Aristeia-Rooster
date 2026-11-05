import { Component, useEffect, useState } from 'react'
import { nl } from './strings.js'

// If a screen crashes, show a friendly message with a reload button instead of a white page.
export class FoutGrens extends Component {
  state = { kapot: false }
  static getDerivedStateFromError() {
    return { kapot: true }
  }
  componentDidCatch(error) {
    console.error('app fout', error)
  }
  render() {
    if (!this.state.kapot) return this.props.children
    return (
      <main className="page">
        <div className="card stack">
          <h2>{nl.crashTitel}</h2>
          <p>{nl.crashTekst}</p>
          <button className="btn" onClick={() => location.reload()}>
            {nl.opnieuwLaden}
          </button>
        </div>
      </main>
    )
  }
}

// Failed button actions (network down, server error) show a message instead of silently doing nothing.
export function FoutVanger() {
  const [bericht, setBericht] = useState('')
  useEffect(() => {
    const op = (e) => {
      if (e.reason?.message === 'sessie_ongeldig') return // handled by the login screen
      setBericht(nl.foutMelding)
      clearTimeout(op.t)
      op.t = setTimeout(() => setBericht(''), 6000)
    }
    window.addEventListener('unhandledrejection', op)
    return () => window.removeEventListener('unhandledrejection', op)
  }, [])
  if (!bericht) return null
  return (
    <div className="banner fout-vanger" role="alert">
      {bericht}
    </div>
  )
}
