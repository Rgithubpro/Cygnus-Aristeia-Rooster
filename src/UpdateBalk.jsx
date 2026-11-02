import { useEffect, useState } from 'react'
import { bijUpdate, pasToe } from './update.js'
import { nl } from './strings.js'

export default function UpdateBalk() {
  const [wacht, setWacht] = useState(false)
  useEffect(() => bijUpdate(setWacht), [])
  if (!wacht) return null
  return (
    <div className="update-balk" role="status">
      <span>{nl.nieuweVersie}</span>
      <button className="btn klein" onClick={pasToe}>
        {nl.vernieuwen}
      </button>
    </div>
  )
}
