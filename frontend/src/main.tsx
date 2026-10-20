import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider, createTheme } from '@mantine/core'
import { registerSW } from 'virtual:pwa-register'
import '@mantine/core/styles.css'
import './index.css'
import App from './App.tsx'

const theme = createTheme({ fontFamily: "'Archivo Variable', ui-sans-serif, system-ui, sans-serif" })

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme}>
      <App />
    </MantineProvider>
  </StrictMode>,
)
