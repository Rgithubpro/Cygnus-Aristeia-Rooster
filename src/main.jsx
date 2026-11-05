import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { FoutGrens } from './FoutGrens.jsx'
import { startUpdates } from './update.js'
import './styles.css'

startUpdates()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FoutGrens>
      <App />
    </FoutGrens>
  </StrictMode>,
)
