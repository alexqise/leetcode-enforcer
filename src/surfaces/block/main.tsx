import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../styles/tokens.css'
import { UIPickerProvider } from '../../_uipicker/UIPickerContext'
import { UIPickerOverlay } from '../../_uipicker/UIPickerOverlay'
import { App } from './App'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <UIPickerProvider storageKey="ui-picker-BlockMain">
      <App />
      <UIPickerOverlay
        label="Block layout"
        variants={[
          { id: 'a', name: 'Coach letter' },
          { id: 'e', name: 'Full scene' },
        ]}
      />
    </UIPickerProvider>
  </StrictMode>,
)
