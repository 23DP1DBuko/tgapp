import { useCallback, useState } from 'react'

import {
  subscribeToProductNotify,
  unsubscribeFromProductNotify,
} from '../lib/firebase/notifySubscribers'
import { readStoredJson, writeStoredJson } from '../lib/storage'

const NOTIFY_SUBSCRIPTIONS_KEY = 'yungwear-notify-subscriptions'

export type UseNotifySubscriptionResult = {
  isSubscribed: (productId: string) => boolean
  subscribe: (productId: string) => Promise<void>
  unsubscribe: (productId: string) => Promise<void>
}

export function useNotifySubscription(
  initData: string,
): UseNotifySubscriptionResult {
  const [subscribedProductIds, setSubscribedProductIds] = useState<string[]>(
    () => readStoredJson<string[]>(NOTIFY_SUBSCRIPTIONS_KEY, []),
  )

  const persist = useCallback((next: string[]) => {
    setSubscribedProductIds(next)
    writeStoredJson(NOTIFY_SUBSCRIPTIONS_KEY, next)
  }, [])

  const isSubscribed = useCallback(
    (productId: string) => subscribedProductIds.includes(productId),
    [subscribedProductIds],
  )

  const subscribe = useCallback(
    async (productId: string) => {
      if (!initData) return
      await subscribeToProductNotify(initData, productId)
      persist([...subscribedProductIds, productId])
    },
    [initData, subscribedProductIds, persist],
  )

  const unsubscribe = useCallback(
    async (productId: string) => {
      if (!initData) return
      await unsubscribeFromProductNotify(initData, productId)
      persist(subscribedProductIds.filter((id) => id !== productId))
    },
    [initData, subscribedProductIds, persist],
  )

  return { isSubscribed, subscribe, unsubscribe }
}
