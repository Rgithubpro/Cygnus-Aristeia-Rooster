import { useEffect, useState } from 'react'
import { bijUpdate, pasToe } from './update.js'
import { txt } from './t.js'

export default function UpdateBalk() {
  const [wacht, setWacht] = useState(false)
  useEffect(() => bijUpdate(setWacht), [])
  if (!wacht) return null
  return (
    <div className="update-balk" role="status">
      <span>{txt('Er is een nieuwe versie van de app.')}</span>
      <button className="btn klein" onClick={pasToe}>
        {txt('Nu vernieuwen')}
      </button>
    </div>
  )
}
