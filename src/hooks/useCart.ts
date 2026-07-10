import { useEffect, useMemo, useState } from 'react'

import { updateProductCartCount } from '../lib/firebase/products'
import { readStoredJson, writeStoredJson } from '../lib/storage'
import type { CartItem } from '../types/cart'
import type { Product } from '../types/product'

const CART_STORAGE_KEY = 'yungwear-cart-items'

export type UseCartOptions = {
  requireTelegramAccess: (action: string) => boolean
  productIdSet: Set<string>
  availableProductIdSet: Set<string>
  onError?: (message: string) => void
}

export type UseCartResult = {
  cartItems: CartItem[]
  checkoutSubtotal: number
  unavailableCartProductIds: string[]
  cartCount: number
  handleAddToCart: (product: Product) => Promise<void>
  handleRemoveFromCart: (productId: string) => Promise<void>
  clearCart: () => void
}

export function useCart(options: UseCartOptions): UseCartResult {
  const { requireTelegramAccess, productIdSet, availableProductIdSet, onError } = options
  const reportError = onError ?? console.error

  const [cartItems, setCartItems] = useState<CartItem[]>(() =>
    readStoredJson<CartItem[]>(CART_STORAGE_KEY, []),
  )

  useEffect(() => {
    writeStoredJson(CART_STORAGE_KEY, cartItems)
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

  const cartCount = cartItems.length

  useEffect(() => {
    if (unavailableCartProductIds.length === 0) {
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCartItems((currentItems) =>
      currentItems.filter((item) => !unavailableCartProductIds.includes(item.productId)),
    )
    reportError(
      'One or more items were removed from your cart because they are no longer available.',
    )
  }, [onError, reportError, unavailableCartProductIds])

  async function handleAddToCart(product: Product) {
    if (!requireTelegramAccess('Cart actions')) {
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
          price: product.price,
          currency: product.currency,
          image: product.images[0] ?? null,
        },
      ]
    })

    try {
      await updateProductCartCount(product.id, 1)
    } catch (error) {
      setCartItems((currentItems) =>
        currentItems.filter((item) => item.productId !== product.id),
      )
      reportError(
        error instanceof Error ? error.message : 'Failed to update cart count.',
      )
    }
  }

  async function handleRemoveFromCart(productId: string) {
    if (!requireTelegramAccess('Cart actions')) {
      return
    }

    const itemToRemove = cartItems.find((item) => item.productId === productId)

    if (!itemToRemove) {
      return
    }

    setCartItems((currentItems) =>
      currentItems.filter((item) => item.productId !== productId),
    )

    if (!productIdSet.has(productId)) {
      return
    }

    try {
      await updateProductCartCount(productId, -1)
    } catch (error) {
      setCartItems((currentItems) => [...currentItems, itemToRemove])
      reportError(
        error instanceof Error ? error.message : 'Failed to update cart count.',
      )
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
    clearCart,
  }
}
