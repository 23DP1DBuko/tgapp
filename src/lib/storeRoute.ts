export type StoreScreen =
  | 'catalog'
  | 'product'
  | 'likes'
  | 'orders'
  | 'cart'
  | 'checkout'
  | 'success'
  | 'rewards'
  | 'preferences'
  | 'privacy'
  | 'terms'
  | 'about'

export type AdminSubView = 'dashboard' | 'catalog' | 'growth' | 'orders' | 'rewards'

export type RouteState = {
  activeView: 'store' | 'admin'
  storeScreen: StoreScreen
  adminSubView: AdminSubView
  selectedProductId: string | null
  checkoutStep: number
}

export function readRouteFromHash(): RouteState {
  if (typeof window === 'undefined' || !window.location.hash) {
    return {
      activeView: 'store',
      storeScreen: 'catalog',
      adminSubView: 'dashboard',
      selectedProductId: null,
      checkoutStep: 1,
    }
  }

  const rawHash = window.location.hash.replace(/^#\/?/, '')
  const [root, subview, third] = rawHash.split('/')

  if (root === 'admin') {
    return {
      activeView: 'admin',
      storeScreen: 'catalog',
      adminSubView: isAdminSubview(subview) ? subview : 'dashboard',
      selectedProductId: null,
      checkoutStep: 1,
    }
  }

  if (root === 'store') {
    const nextStoreScreen = isStoreScreen(subview) ? subview : 'catalog'

    // Parse checkout step from hash: #/store/checkout/2
    const parsedStep =
      nextStoreScreen === 'checkout' && third
        ? Number.parseInt(third, 10) || 1
        : 1

    // For product, fourth segment is not used; third is productId
    const productId =
      nextStoreScreen === 'product' && third ? third : null

    return {
      activeView: 'store',
      storeScreen: nextStoreScreen,
      adminSubView: 'dashboard',
      selectedProductId: productId,
      checkoutStep: Math.max(1, Math.min(3, parsedStep)),
    }
  }

  return {
    activeView: 'store',
    storeScreen: 'catalog',
    adminSubView: 'dashboard',
    selectedProductId: null,
    checkoutStep: 1,
  }
}

export function buildRouteHash(route: RouteState) {
  if (route.activeView === 'admin') {
    return `#/admin/${route.adminSubView}`
  }

  if (route.storeScreen === 'product' && route.selectedProductId) {
    return `#/store/product/${route.selectedProductId}`
  }

  if (route.storeScreen === 'checkout') {
    return `#/store/checkout/${route.checkoutStep}`
  }

  return `#/store/${route.storeScreen}`
}

export function isStoreScreen(value?: string): value is StoreScreen {
  return (
    value === 'catalog' ||
    value === 'product' ||
    value === 'likes' ||
    value === 'orders' ||
    value === 'cart' ||
    value === 'checkout' ||
    value === 'success' ||
    value === 'rewards' ||
    value === 'preferences' ||
    value === 'privacy' ||
    value === 'terms' ||
    value === 'about'
  )
}

export function isAdminSubview(value?: string): value is AdminSubView {
  return value === 'dashboard' || value === 'catalog' || value === 'growth' || value === 'orders' || value === 'rewards'
}


