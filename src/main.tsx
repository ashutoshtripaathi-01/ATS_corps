import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Apply saved theme before first paint to prevent flash of wrong mode
try {
  const stored = JSON.parse(localStorage.getItem('ats-corps-store') || '{}')
  if (stored?.state?.theme === 'dark') {
    document.documentElement.classList.add('dark')
  }
} catch { /* ignore – fresh session */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
