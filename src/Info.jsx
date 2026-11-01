import { useData } from './data.jsx'
import { nl } from './strings.js'
import BerichtKaart from './BerichtKaart.jsx'

export default function Info() {
  const { data } = useData()
  const lijst = data.berichten.filter((b) => b.gepubliceerd)
  if (lijst.length === 0) return <p className="note">{nl.leegInfo}</p>
  return (
    <ul className="stack lijst-los">
      {lijst.map((b) => (
        <BerichtKaart key={b.id} b={b} />
      ))}
    </ul>
  )
}
