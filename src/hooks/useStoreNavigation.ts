import { useEffect, useState } from 'react'

import { buildRouteHash, readRouteFromHash } from '../lib/storeRoute'
import { withViewTransition } from '../lib/viewTransition'
import type { AdminSubView } from '../lib/storeRoute'
import type { ProductCategory } from '../types/product'

export type StoreScreen =
  | 'catalog'
  | 'product'
  | 'likes'
  | 'orders'
  | 'cart'
  | 'checkout'
  | 'success'
  | 'rewards'
  | 'polls'
  | 'privacy'
  | 'terms'
  | 'about'

export type UseStoreNavigationResult = {
  activeView: 'store' | 'admin'
  storeScreen: StoreScreen
  adminSubView: AdminSubView
  storeCollectionView: 'all' | 'liked'
  storeSortMode: 'latest' | 'trending'
  storeSearchQuery: string
  selectedCategory: 'all' | ProductCategory
  selectedProductId: string | null
  telegramGateMessage: string | null
  promoCodeRaw: string
  setActiveView: React.Dispatch<React.SetStateAction<'store' | 'admin'>>
  setStoreScreen: React.Dispatch<React.SetStateAction<StoreScreen>>
  setAdminSubView: React.Dispatch<React.SetStateAction<AdminSubView>>
  setStoreCollectionView: React.Dispatch<React.SetStateAction<'all' | 'liked'>>
  setStoreSortMode: React.Dispatch<React.SetStateAction<'latest' | 'trending'>>
  setStoreSearchQuery: React.Dispatch<React.SetStateAction<string>>
  setSelectedCategory: React.Dispatch<React.SetStateAction<'all' | ProductCategory>>
  setSelectedProductId: React.Dispatch<React.SetStateAction<string | null>>
  checkoutStep: number
  setCheckoutStep: React.Dispatch<React.SetStateAction<number>>
  setTelegramGateMessage: React.Dispatch<React.SetStateAction<string | null>>
  setPromoCodeRaw: React.Dispatch<React.SetStateAction<string>>
  requireTelegramAccess: (actionLabel: string) => boolean
  handleOpenCatalog: () => void
  handleResetCatalogFilters: () => void
  handleOpenMyOrders: () => void
  handleOpenLikes: () => void
  handleOpenProduct: (productId: string) => void
  handleOpenCart: () => void
  handleOpenRewards: () => void
  handleOpenPolls: () => void
  handleSelectCollectionView: (view: 'all' | 'liked') => void
  handleOpenLikedProduct: (productId: string) => void
  handleBackFromProduct: () => void
  handleTripleTap: () => void
}

export function useStoreNavigation(
  hasTelegramBuyerAccess: boolean,
): UseStoreNavigationResult {
  const initialRoute = readRouteFromHash()

  const [activeView, setActiveView] = useState<'store' | 'admin'>(initialRoute.activeView)
  const [storeScreen, setStoreScreen] = useState<StoreScreen>(() => {
    if (initialRoute.storeScreen === 'success') {
      return 'cart'
    }
    return initialRoute.storeScreen
  })
  const [adminSubView, setAdminSubView] = useState<AdminSubView>(initialRoute.adminSubView)
  const [storeCollectionView, setStoreCollectionView] = useState<'all' | 'liked'>('all')
  const [storeSortMode, setStoreSortMode] = useState<'latest' | 'trending'>('latest')
  const [storeSearchQuery, setStoreSearchQuery] = useState('')
  const [telegramGateMessage, setTelegramGateMessage] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<'all' | ProductCategory>('all')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    initialRoute.selectedProductId,
  )
  const [checkoutStep, setCheckoutStep] = useState(initialRoute.checkoutStep)
  const [promoCodeRaw, setPromoCodeRaw] = useState('')

  // --- Helpers ---

  function requireTelegramAccess(actionLabel: string) {
    if (hasTelegramBuyerAccess) {
      return true
    }

    setTelegramGateMessage(
      `${actionLabel} is available only inside the Telegram Mini App with a real Telegram session. Open the app in Telegram to continue with real likes, cart, and checkout.`,
    )

    return false
  }

  // --- Event handlers ---

  function handleOpenCatalog() {
    setStoreScreen('catalog')
    setStoreCollectionView('all')
  }

  function handleResetCatalogFilters() {
    setStoreSearchQuery('')
    setSelectedCategory('all')
    setStoreCollectionView('all')
    setStoreSortMode('latest')
    setStoreScreen('catalog')
  }

  function handleOpenMyOrders() {
    if (!requireTelegramAccess('Order history')) {
      return
    }
    setStoreScreen('orders')
  }

  function handleOpenLikes() {
    if (!requireTelegramAccess('Saved likes')) {
      return
    }
    setStoreCollectionView('liked')
    setStoreScreen('likes')
  }

  function handleOpenProduct(productId: string) {
    withViewTransition(() => {
      setSelectedProductId(productId)
      setStoreScreen('product')
    })
  }

  function handleOpenCart() {
    if (!requireTelegramAccess('Cart')) {
      return
    }
    setStoreScreen('cart')
  }

  function handleOpenRewards() {
    if (!requireTelegramAccess('Rewards')) {
      return
    }
    setStoreScreen('rewards')
  }

  function handleOpenPolls() {
    if (!requireTelegramAccess('Community Polls')) {
      return
    }
    setStoreScreen('polls')
  }

  function handleSelectCollectionView(view: 'all' | 'liked') {
    setStoreCollectionView(view)
    setStoreScreen(view === 'liked' ? 'likes' : 'catalog')
  }

  function handleOpenLikedProduct(productId: string) {
    setStoreCollectionView('liked')
    handleOpenProduct(productId)
  }

  function handleBackFromProduct() {
    setStoreScreen(storeCollectionView === 'liked' ? 'likes' : 'catalog')
  }

  function handleTripleTap() {
    if (activeView === 'admin') {
      setActiveView('store')
      setStoreScreen('catalog')
    } else {
      setActiveView('admin')
      setAdminSubView('dashboard')
    }
  }

  // --- Self-contained effects ---

  // Sync hash to current route state
  useEffect(() => {
    const nextHash = buildRouteHash({
      activeView,
      storeScreen,
      adminSubView,
      selectedProductId,
      checkoutStep,
    })

    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash
    }
  }, [activeView, adminSubView, checkoutStep, selectedProductId, storeScreen])

  // Smooth-scroll to top on catalog, likes, or rewards
  useEffect(() => {
    if (storeScreen === 'catalog' || storeScreen === 'likes' || storeScreen === 'rewards') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [storeScreen])

  return {
    activeView,
    storeScreen,
    adminSubView,
    storeCollectionView,
    storeSortMode,
    storeSearchQuery,
    selectedCategory,
    selectedProductId,
    checkoutStep,
    setCheckoutStep,
    telegramGateMessage,
    promoCodeRaw,
    setActiveView,
    setStoreScreen,
    setAdminSubView,
    setStoreCollectionView,
    setStoreSortMode,
    setStoreSearchQuery,
    setSelectedCategory,
    setSelectedProductId,
    setTelegramGateMessage,
    setPromoCodeRaw,
    requireTelegramAccess,
    handleOpenCatalog,
    handleResetCatalogFilters,
    handleOpenMyOrders,
    handleOpenLikes,
    handleOpenProduct,
    handleOpenCart,
    handleOpenRewards,
    handleOpenPolls,
    handleSelectCollectionView,
    handleOpenLikedProduct,
    handleBackFromProduct,
    handleTripleTap,
  }
}
