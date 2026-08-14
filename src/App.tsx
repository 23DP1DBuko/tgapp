import { useEffect } from 'react'

import { disableVerticalSwipes } from './lib/telegram/webApp'
import { AddToCartAnimationProvider } from './hooks/useAddToCartAnimation'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { LanguageProvider } from './lib/i18n'
import { HomePage } from './pages/HomePage'

function App() {
  // Disable accidental swipe-to-close in Telegram Mini App
  useEffect(() => {
    disableVerticalSwipes()
  }, [])

  // Prevent context menus globally on all images (long-press save, copy, etc.)
  useEffect(() => {
    function handleContextMenu(event: MouseEvent) {
      const target = event.target as HTMLElement | null
      if (target && target.tagName === 'IMG') {
        event.preventDefault()
      }
    }
    document.addEventListener('contextmenu', handleContextMenu)
    return () => document.removeEventListener('contextmenu', handleContextMenu)
  }, [])

  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AddToCartAnimationProvider>
          <HomePage />
        </AddToCartAnimationProvider>
      </LanguageProvider>
    </ErrorBoundary>
  )
}

export default App
