import { useMemo } from 'react'

import type { CartItem } from '../types/cart'
import type { Product, ProductCategory } from '../types/product'

export type UseProductFilteringOptions = {
  products: Product[]
  likedProductIdSet: Set<string>
  likedProductIds: string[]
  storeCollectionView: 'all' | 'liked'
  storeSearchQuery: string
  selectedCategory: 'all' | ProductCategory
  storeSortMode: 'latest' | 'trending'
  selectedProductId: string | null
  cartItems: CartItem[]
}

export type UseProductFilteringResult = {
  categoryOptions: Array<'all' | ProductCategory>
  productIdSet: Set<string>
  availableProductIdSet: Set<string>
  filteredProducts: Product[]
  sortedProducts: Product[]
  selectedProduct: Product | null
  isSelectedProductInCart: boolean
  isSelectedProductLiked: boolean
}

function getProductHeatScore(product: Product) {
  return product.likesCount + product.cartCount * 2
}

export function useProductFiltering(
  options: UseProductFilteringOptions,
): UseProductFilteringResult {
  const {
    products,
    likedProductIdSet,
    likedProductIds,
    storeCollectionView,
    storeSearchQuery,
    selectedCategory,
    storeSortMode,
    selectedProductId,
    cartItems,
  } = options

  const categoryOptions = useMemo(() => {
    const categories = new Set<ProductCategory>()
    products.forEach((product) => categories.add(product.category))
    return ['all', ...categories] as Array<'all' | ProductCategory>
  }, [products])

  const productIdSet = useMemo(() => new Set(products.map((p) => p.id)), [products])

  const availableProductIdSet = useMemo(
    () => new Set(products.filter((p) => p.isAvailable).map((p) => p.id)),
    [products],
  )

  const filteredProducts = useMemo(() => {
    const normalizedQuery = storeSearchQuery.trim().toLowerCase()

    const nextProducts =
      storeCollectionView === 'liked'
        ? products.filter((product) => likedProductIdSet.has(product.id))
        : products

    const categoryFiltered =
      selectedCategory === 'all'
        ? nextProducts
        : nextProducts.filter((product) => product.category === selectedCategory)

    if (!normalizedQuery) return categoryFiltered

    return categoryFiltered.filter((product) => {
      const searchBody = [product.name, product.category, ...product.brandNames]
        .join(' ')
        .toLowerCase()
      return searchBody.includes(normalizedQuery)
    })
  }, [likedProductIdSet, products, selectedCategory, storeCollectionView, storeSearchQuery])

  const sortedProducts = useMemo(() => {
    const nextProducts = [...filteredProducts]

    if (storeCollectionView === 'liked') {
      // Sort by most recently liked first (reverse index in likedProductIds)
      nextProducts.sort((a, b) => {
        const aIndex = likedProductIds.indexOf(a.id)
        const bIndex = likedProductIds.indexOf(b.id)
        return bIndex - aIndex
      })
    } else {
      nextProducts.sort((a, b) => {
        if (storeSortMode === 'trending') {
          const diff = getProductHeatScore(b) - getProductHeatScore(a)
          if (diff !== 0) return diff
        }

        const aTime = a.createdAt?.toMillis() ?? 0
        const bTime = b.createdAt?.toMillis() ?? 0
        return bTime - aTime
      })
    }

    return nextProducts
  }, [filteredProducts, storeSortMode, storeCollectionView, likedProductIds])

  const selectedProduct = useMemo(() => {
    const matched = selectedProductId
      ? sortedProducts.find((p) => p.id === selectedProductId) ?? null
      : null
    return matched ?? sortedProducts[0] ?? null
  }, [selectedProductId, sortedProducts])

  const isSelectedProductInCart = useMemo(() => {
    if (!selectedProduct) return false
    return cartItems.some((item) => item.productId === selectedProduct.id)
  }, [cartItems, selectedProduct])

  const isSelectedProductLiked = useMemo(() => {
    if (!selectedProduct) return false
    return likedProductIds.includes(selectedProduct.id)
  }, [likedProductIds, selectedProduct])

  return {
    categoryOptions,
    productIdSet,
    availableProductIdSet,
    filteredProducts,
    sortedProducts,
    selectedProduct,
    isSelectedProductInCart,
    isSelectedProductLiked,
  }
}
