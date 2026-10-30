import { useEffect, useState } from 'react'
import { nl } from './strings.js'
import Mark from './Mark.jsx'

// Placeholder rows, only to show what the real schedule will look like.
const EXAMPLE = [
  { time: '08:30 – 09:20', subject: 'Wiskunde', room: 'B2.14', teacher: 'Mevr. De Vries', status: null },
  { time: '09:20 – 10:10', subject: 'Nederlands', room: 'A1.05 (was A1.03)', teacher: 'Dhr. Bakker', status: 'moved' },
  { time: '10:30 – 11:20', subject: 'Gym', room: 'Sporthal', teacher: 'Dhr. Jansen', status: 'cancelled' },
]

const BADGE = { moved: nl.badgeMoved, cancelled: nl.badgeCancelled }

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

const buildDate = new Intl.DateTimeFormat('nl-NL', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Amsterdam',
}).format(new Date(__BUILD_TIME__))

export default function App() {
  const online = useOnline()

  return (
    <main className="page">
      <header className="head">
        <Mark />
        <div>
          <h1>{nl.title}</h1>
          <p className="tagline">{nl.tagline}</p>
        </div>
      </header>

      {!online && (
        <p className="banner" role="status">
          {nl.offlineBanner}
        </p>
      )}

      <section aria-labelledby="today">
        <div className="section-head">
          <h2 id="today">{nl.todayHeading}</h2>
          <span className="tag">{nl.exampleTag}</span>
        </div>
        <ol className="lessons">
          {EXAMPLE.map((l) => (
            <li key={l.time} className={l.status ? `lesson ${l.status}` : 'lesson'}>
              <span className="time">{l.time}</span>
              <span className="what">
                <strong>{l.subject}</strong>
                <span className="meta">
                  {l.room}, {l.teacher}
                </span>
              </span>
              {l.status && <span className={`badge ${l.status}`}>{BADGE[l.status]}</span>}
            </li>
          ))}
        </ol>
        <p className="note">{nl.exampleNote}</p>
      </section>

      <section aria-labelledby="status">
        <h2 id="status">{nl.statusHeading}</h2>
        <dl className="status">
          <div>
            <dt>{nl.connection}</dt>
            <dd>{online ? nl.online : nl.offline}</dd>
          </div>
          <div>
            <dt>{nl.installed}</dt>
            <dd>{isInstalled() ? nl.yes : nl.no}</dd>
          </div>
          <div>
            <dt>{nl.version}</dt>
            <dd>
              {__COMMIT__}, {buildDate}
            </dd>
          </div>
        </dl>
      </section>
    </main>
  )
}
