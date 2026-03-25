import { useEffect, useState } from 'react'

import { hasFirebaseEnv } from '../lib/firebase/config'
import { listProducts } from '../lib/firebase/products'
import type { Product } from '../types/product'

type UseProductsState = {
  products: Product[]
  isLoading: boolean
  errorMessage: string | null
  reloadProducts: () => void
}

export function useProducts(): UseProductsState {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let isMounted = true

    async function loadProducts() {
      if (!hasFirebaseEnv()) {
        if (!isMounted) {
          return
        }

        setProducts([])
        setErrorMessage('Add Firebase env values to load products from Firestore.')
        setIsLoading(false)
        return
      }

      try {
        const nextProducts = await listProducts()

        if (!isMounted) {
          return
        }

        setProducts(nextProducts)
        setErrorMessage(null)
      } catch (error) {
        if (!isMounted) {
          return
        }

        const message =
          error instanceof Error ? error.message : 'Failed to load products from Firestore.'

        setProducts([])
        setErrorMessage(message)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadProducts()

    return () => {
      isMounted = false
    }
  }, [reloadToken])

  return {
    products,
    isLoading,
    errorMessage,
    reloadProducts: () => setReloadToken((current) => current + 1),
  }
}
