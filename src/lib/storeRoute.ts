export type StoreScreen =
  | 'catalog'
  | 'product'
  | 'likes'
  | 'orders'
  | 'cart'
  | 'checkout'
  | 'success'

export type AdminSubView = 'overview' | 'products' | 'promos' | 'orders' | 'broadcasts'

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
    value === 'success'
  )
}

export function isAdminSubview(value?: string): value is AdminSubView {
  return (
    value === 'overview' ||
    value === 'products' ||
    value === 'promos' ||
    value === 'orders' ||
    value === 'broadcasts'
  )
}

export function getStoreScreenEyebrow(storeScreen: StoreScreen) {
  switch (storeScreen) {
    case 'catalog':
      return 'Catalog'
    case 'product':
      return 'Product View'
    case 'likes':
      return 'Loved Pieces'
    case 'orders':
      return 'Order Status'
    case 'cart':
      return 'Cart'
    case 'checkout':
      return 'Checkout'
    case 'success':
      return 'Order Sent'
  }
}

export function getStoreScreenTitle(storeScreen: StoreScreen) {
  switch (storeScreen) {
    case 'catalog':
      return 'Drop Floor'
    case 'product':
      return 'Piece Focus'
    case 'likes':
      return 'Saved Heat'
    case 'orders':
      return 'My Orders'
    case 'cart':
      return 'Your Cart'
    case 'checkout':
      return 'Checkout Flow'
    case 'success':
      return 'Order Confirmed'
  }
}

export function getStoreScreenDescription(storeScreen: StoreScreen) {
  switch (storeScreen) {
    case 'catalog':
      return 'Browse the current drop, filter the pieces, and move fast when a product starts getting attention.'
    case 'product':
      return 'Focused product view with image-first detail, loves, and fast add-to-cart actions.'
    case 'likes':
      return 'Your saved pieces in one place so you can revisit them before someone else checks out first.'
    case 'orders':
      return 'Follow your recent order requests, payment progress, and meetup or delivery status inside Telegram.'
    case 'cart':
      return 'Review the pieces you are holding before moving into checkout.'
    case 'checkout':
      return 'Finish fulfillment, payment, and confirmation without extra store noise on screen.'
    case 'success':
      return 'Your order request is in. From here you can jump back into the catalog or wait for follow-up.'
  }
}
