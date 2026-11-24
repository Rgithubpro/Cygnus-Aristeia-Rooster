import { useData } from './data.jsx'
import BerichtKaart from './BerichtKaart.jsx'
import { txt } from './t.js'

export default function Info() {
  const { data } = useData()
  const lijst = data.berichten.filter((b) => b.gepubliceerd)
  if (lijst.length === 0) return <p className="note">{txt('Er zijn nog geen berichten geplaatst.')}</p>
  return (
    <ul className="stack lijst-los">
      {lijst.map((b) => (
        <BerichtKaart key={b.id} b={b} />
      ))}
    </ul>
  )
}
