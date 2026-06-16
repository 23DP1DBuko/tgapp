import { useEffect, useState } from 'react'

import { hasFirebaseEnv } from '../lib/firebase/config'
import { subscribeToProducts } from '../lib/firebase/products'
import type { Product } from '../types/product'

type UseProductsState = {
  products: Product[]
  isLoading: boolean
  errorMessage: string | null
  reloadProducts: () => void
}

export function useProducts(): UseProductsState {
  const firebaseEnvReady = hasFirebaseEnv()
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(firebaseEnvReady)
  const [errorMessage, setErrorMessage] = useState<string | null>(
    firebaseEnvReady ? null : 'Add Firebase env values to load products from Firestore.',
  )
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!firebaseEnvReady) {
      return () => undefined
    }

    const unsubscribe = subscribeToProducts(
      (nextProducts) => {
        setProducts(nextProducts)
        setErrorMessage(null)
        setIsLoading(false)
      },
      (message) => {
        setProducts([])
        setErrorMessage(message)
        setIsLoading(false)
      },
    )

    return unsubscribe
  }, [firebaseEnvReady, reloadToken])

  return {
    products,
    isLoading,
    errorMessage,
    reloadProducts: () => {
      setIsLoading(true)
      setReloadToken((current) => current + 1)
    },
  }
}
