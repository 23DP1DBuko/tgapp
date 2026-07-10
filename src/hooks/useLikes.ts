import { useEffect, useMemo, useState } from 'react'

import { updateProductLikesCount } from '../lib/firebase/products'
import { readStoredJson, writeStoredJson } from '../lib/storage'
import type { Product } from '../types/product'

const LIKED_PRODUCTS_STORAGE_KEY = 'yungwear-liked-products'

export type UseLikesOptions = {
  requireTelegramAccess: (action: string) => boolean
  productIdSet: Set<string>
  onError?: (message: string) => void
}

export type UseLikesResult = {
  likedProductIds: string[]
  likedProductIdSet: Set<string>
  validLikedProductIds: string[]
  likedCount: number
  handleToggleLike: (product: Product) => Promise<void>
}

export function useLikes(options: UseLikesOptions): UseLikesResult {
  const { requireTelegramAccess, productIdSet, onError } = options
  const reportError = onError ?? console.error

  const [likedProductIds, setLikedProductIds] = useState<string[]>(() =>
    readStoredJson<string[]>(LIKED_PRODUCTS_STORAGE_KEY, []),
  )

  useEffect(() => {
    writeStoredJson(LIKED_PRODUCTS_STORAGE_KEY, likedProductIds)
  }, [likedProductIds])

  // Remove liked product IDs that no longer exist in the product set
  useEffect(() => {
    if (productIdSet.size === 0) {
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLikedProductIds((currentIds) =>
      currentIds.filter((productId) => productIdSet.has(productId)),
    )
  }, [productIdSet])

  const likedProductIdSet = useMemo(() => new Set(likedProductIds), [likedProductIds])

  const validLikedProductIds = useMemo(
    () => likedProductIds.filter((productId) => productIdSet.has(productId)),
    [likedProductIds, productIdSet],
  )

  const likedCount = validLikedProductIds.length

  async function handleToggleLike(product: Product) {
    if (!requireTelegramAccess('Likes')) {
      return
    }

    const isLiked = likedProductIds.includes(product.id)

    setLikedProductIds((currentIds) =>
      isLiked
        ? currentIds.filter((currentId) => currentId !== product.id)
        : [...currentIds, product.id],
    )

    try {
      await updateProductLikesCount(product.id, isLiked ? -1 : 1)
    } catch (error) {
      // Rollback on failure
      setLikedProductIds((currentIds) =>
        isLiked
          ? [...currentIds, product.id]
          : currentIds.filter((currentId) => currentId !== product.id),
      )
      reportError(
        error instanceof Error ? error.message : 'Failed to update likes.',
      )
    }
  }

  return {
    likedProductIds,
    likedProductIdSet,
    validLikedProductIds,
    likedCount,
    handleToggleLike,
  }
}
