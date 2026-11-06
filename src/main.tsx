import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './index.css'

try { if (localStorage.getItem('carecircle-large-text') === '1') document.documentElement.classList.add('large-text') } catch {}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
