import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './app/router'
import { LiveGameProvider } from './features/game/LiveGameProvider'
import { StoreProvider } from './store/StoreProvider'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <LiveGameProvider>
        <RouterProvider router={router} />
      </LiveGameProvider>
    </StoreProvider>
  </StrictMode>,
)
