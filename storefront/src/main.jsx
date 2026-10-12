import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initI18n } from './i18n'
import App from './App.jsx'

// Awaited before the first render so there's no flash of untranslated
// content — initI18n() only blocks on the active language's own JSON
// chunks (see src/i18n/index.js), not the other two languages.
initI18n().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
