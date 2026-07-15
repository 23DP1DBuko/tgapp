import { useCallback, useEffect, useMemo, useState } from 'react'

import { updateProductLikesCount } from '../lib/firebase/products'
import { readStoredJson, writeStoredJson } from '../lib/storage'
import type { Product } from '../types/product'

const LIKED_PRODUCTS_STORAGE_KEY = 'yungwear-liked-products'

export type UseLikesOptions = {
  requireTelegramAccess: (action: string) => boolean
  productIdSet: Set<string>
  initData: string
  onError?: (message: string) => void
}

export type UseLikesResult = {
  likedProductIds: string[]
  likedProductIdSet: Set<string>
  validLikedProductIds: string[]
  likedCount: number
  hasUnreadLikes: boolean
  clearUnreadLikes: () => void
  handleToggleLike: (product: Product) => Promise<void>
}

export function useLikes(options: UseLikesOptions): UseLikesResult {
  const { requireTelegramAccess, productIdSet, initData, onError } = options
  const reportError = onError ?? console.error

  const [likedProductIds, setLikedProductIds] = useState<string[]>(() =>
    readStoredJson<string[]>(LIKED_PRODUCTS_STORAGE_KEY, []),
  )
  const [hasUnreadLikes, setHasUnreadLikes] = useState(false)

  const clearUnreadLikes = useCallback(() => {
    setHasUnreadLikes(false)
  }, [])

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

    // Set unread flag when adding a new like
    if (!isLiked) {
      setHasUnreadLikes(true)
    }

    try {
      await updateProductLikesCount(initData, product.id, isLiked ? -1 : 1)
    } catch (error) {
      // Rollback on failure — restore unread flag to its previous value
      setLikedProductIds((currentIds) =>
        isLiked
          ? [...currentIds, product.id]
          : currentIds.filter((currentId) => currentId !== product.id),
      )
      if (!isLiked) {
        setHasUnreadLikes(false)
      }
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
    hasUnreadLikes,
    clearUnreadLikes,
    handleToggleLike,
  }
}
