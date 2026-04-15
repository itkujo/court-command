import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const root = document.getElementById('root')!
createRoot(root).render(
  <StrictMode>
    <div>Court Command loading...</div>
  </StrictMode>,
)
