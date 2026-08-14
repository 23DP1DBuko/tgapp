import { useEffect, useMemo, useState } from 'react'

import { updateProductCartCount } from '../lib/firebase/products'
import { getProductEffectivePrice } from '../lib/productPrice'
import { readUserStateJson, writeUserStateJson } from '../lib/userState'
import { translate } from '../lib/i18n/translate'
import type { TranslationKey } from '../lib/i18n/translations'
import type { CartItem } from '../types/cart'
import type { Product } from '../types/product'

const CART_STORAGE_KEY = 'yungwear-cart-items'

export type UseCartOptions = {
  requireTelegramAccess: (actionKey: TranslationKey) => boolean
  productIdSet: Set<string>
  availableProductIdSet: Set<string>
  /** Product ids used as prizes in non-draft giveaways — they can't be bought,
   *  so any cart item pointing at one is pruned (with a specific message). */
  giveawayPrizeProductIdSet: Set<string>
  /** Products from already-drawn giveaways — also not buyable, same pruning. */
  givenAwayProductIdSet: Set<string>
  /** False until the product catalog has finished loading (without an error).
   *  Unavailable-item pruning must not run before that, or a page reload would
   *  wipe the whole restored cart while products are still loading. */
  productsLoaded: boolean
  initData: string
  onError?: (message: string) => void
}

export type UseCartResult = {
  cartItems: CartItem[]
  checkoutSubtotal: number
  unavailableCartProductIds: string[]
  cartCount: number
  handleAddToCart: (product: Product) => Promise<void>
  handleRemoveFromCart: (productId: string) => Promise<CartItem | null>
  handleRestoreItem: (item: CartItem) => void
  clearCart: () => void
}

export function useCart(options: UseCartOptions): UseCartResult {
  const {
    requireTelegramAccess,
    productIdSet,
    availableProductIdSet,
    giveawayPrizeProductIdSet,
    givenAwayProductIdSet,
    productsLoaded,
    initData,
    onError,
  } = options
  const reportError = onError ?? console.error

  const [cartItems, setCartItems] = useState<CartItem[]>(() =>
    readUserStateJson<CartItem[]>(CART_STORAGE_KEY, []),
  )

  useEffect(() => {
    writeUserStateJson(CART_STORAGE_KEY, cartItems)
  }, [cartItems])

  const checkoutSubtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price, 0),
    [cartItems],
  )

  const unavailableCartProductIds = useMemo(
    () =>
      cartItems
        .filter((item) => !availableProductIdSet.has(item.productId))
        .map((item) => item.productId),
    [availableProductIdSet, cartItems],
  )

  const giveawayCartProductIds = useMemo(
    () =>
      cartItems
        .filter(
          (item) =>
            giveawayPrizeProductIdSet.has(item.productId) ||
            givenAwayProductIdSet.has(item.productId),
        )
        .map((item) => item.productId),
    [givenAwayProductIdSet, giveawayPrizeProductIdSet, cartItems],
  )

  const cartCount = cartItems.length

  useEffect(() => {
    // Only prune once the catalog has actually loaded: before that the
    // availability set is empty (a page reload starts with products=[]), and
    // pruning would remove every item from the restored cart.
    const prunableIds = [...unavailableCartProductIds, ...giveawayCartProductIds]
    if (!productsLoaded || prunableIds.length === 0) {
      return
    }

    const prunedGiveaway = giveawayCartProductIds.length > 0

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCartItems((currentItems) =>
      currentItems.filter((item) => !prunableIds.includes(item.productId)),
    )
    reportError(
      prunedGiveaway
        ? translate('cartError.giveawayRemoved')
        : translate('cartError.removedItems'),
    )
  }, [
    giveawayCartProductIds,
    onError,
    productsLoaded,
    reportError,
    unavailableCartProductIds,
  ])

  async function handleAddToCart(product: Product) {
    if (!requireTelegramAccess('gateAction.cartActions')) {
      return
    }

    const isAlreadyInCart = cartItems.some((item) => item.productId === product.id)

    if (isAlreadyInCart) {
      return
    }

    setCartItems((currentItems) => {
      if (currentItems.some((item) => item.productId === product.id)) {
        return currentItems
      }

      return [
        ...currentItems,
        {
          productId: product.id,
          name: product.name,
          // Snapshot the discounted price — checkout validates it against the
          // product's server-side discount math, so base price would be
          // rejected as a mismatch.
          price: getProductEffectivePrice(product.price, product.discountType, product.discountValue),
          currency: product.currency,
          image: product.images[0] ?? null,
        },
      ]
    })

    // Fire-and-forget: update backend cart counter. If it fails, the local add stays.
    // The local cart is the source of truth; the counter is just a popularity signal.
    try {
      await updateProductCartCount(initData, product.id, 1)
    } catch {
      // Silently fail — local add already happened
    }
  }

  async function handleRemoveFromCart(productId: string): Promise<CartItem | null> {
    if (!requireTelegramAccess('gateAction.cartActions')) {
      return null
    }

    let removed: CartItem | null = null
    setCartItems((currentItems) => {
      removed = currentItems.find((item) => item.productId === productId) ?? null
      return currentItems.filter((item) => item.productId !== productId)
    })

    if (!productIdSet.has(productId)) {
      return removed
    }

    // Fire-and-forget: update backend cart counter. If it fails, we don't roll back
    // because the local cart is the source of truth. The counter is a popularity signal.
    try {
      await updateProductCartCount(initData, productId, -1)
    } catch {
      // Silently fail — local removal already happened
    }
    return removed
  }

  /** Re-add a previously removed item (cart swipe-delete undo). */
  function handleRestoreItem(item: CartItem) {
    if (!requireTelegramAccess('gateAction.cartActions')) {
      return
    }

    setCartItems((currentItems) =>
      currentItems.some((existing) => existing.productId === item.productId)
        ? currentItems
        : [...currentItems, item],
    )

    // Fire-and-forget: restore the backend counter too. Local cart is source of truth.
    try {
      void updateProductCartCount(initData, item.productId, 1)
    } catch {
      // Silently fail — local restore already happened
    }
  }

  function clearCart() {
    setCartItems([])
  }

  return {
    cartItems,
    checkoutSubtotal,
    unavailableCartProductIds,
    cartCount,
    handleAddToCart,
    handleRemoveFromCart,
    handleRestoreItem,
    clearCart,
  }
}
