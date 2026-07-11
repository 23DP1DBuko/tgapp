export type StoreScreen =
  | 'catalog'
  | 'product'
  | 'likes'
  | 'orders'
  | 'cart'
  | 'checkout'
  | 'success'
  | 'rewards'

export type AdminSubView = 'overview' | 'products' | 'promos' | 'orders' | 'broadcasts' | 'campaigns' | 'rewards' | 'dashboard'

export type RouteState = {
  activeView: 'store' | 'admin'
  storeScreen: StoreScreen
  adminSubView: AdminSubView
  selectedProductId: string | null
}

export function readRouteFromHash(): RouteState {
  if (typeof window === 'undefined' || !window.location.hash) {
    return {
      activeView: 'store',
      storeScreen: 'catalog',
      adminSubView: 'overview',
      selectedProductId: null,
    }
  }

  const rawHash = window.location.hash.replace(/^#\/?/, '')
  const [root, subview, selectedProductId] = rawHash.split('/')

  if (root === 'admin') {
    return {
      activeView: 'admin',
      storeScreen: 'catalog',
      adminSubView: isAdminSubview(subview) ? subview : 'overview',
      selectedProductId: null,
    }
  }

  if (root === 'store') {
    const nextStoreScreen = isStoreScreen(subview) ? subview : 'catalog'

    return {
      activeView: 'store',
      storeScreen: nextStoreScreen,
      adminSubView: 'overview',
      selectedProductId:
        nextStoreScreen === 'product' && selectedProductId ? selectedProductId : null,
    }
  }

  return {
    activeView: 'store',
    storeScreen: 'catalog',
    adminSubView: 'overview',
    selectedProductId: null,
  }
}

export function buildRouteHash(route: RouteState) {
  if (route.activeView === 'admin') {
    return `#/admin/${route.adminSubView}`
  }

  if (route.storeScreen === 'product' && route.selectedProductId) {
    return `#/store/product/${route.selectedProductId}`
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
    value === 'rewards'
  )
}

export function isAdminSubview(value?: string): value is AdminSubView {
  return (
    value === 'overview' ||
    value === 'products' ||
    value === 'promos' ||
    value === 'orders' ||
    value === 'broadcasts' ||
    value === 'campaigns' ||
    value === 'rewards' ||
    value === 'dashboard'
  )
}


