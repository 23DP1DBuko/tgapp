const DEFAULT_SUBSCRIBE_NOTIFY_URL = '/api/notify/subscribe'
const DEFAULT_UNSUBSCRIBE_NOTIFY_URL = '/api/notify/unsubscribe'
const DEFAULT_TOGGLE_BROADCAST_URL = '/api/notify/toggleBroadcast'

async function readErrorReason(response: Response): Promise<string> {
  let reason = `http_${response.status}`
  let detail = ''
  try {
    const result = (await response.json()) as { reason?: string; detail?: string }
    if (typeof result.reason === 'string') reason = result.reason
    if (typeof result.detail === 'string' && result.detail) detail = result.detail
  } catch {
    // Keep HTTP fallback
  }
  return `${reason}${detail ? ` (${detail})` : ''}`
}

export async function subscribeToProductNotify(
  initData: string,
  productId: string,
): Promise<void> {
  const response = await fetch(
    import.meta.env.VITE_SUBSCRIBE_NOTIFY_URL ?? DEFAULT_SUBSCRIBE_NOTIFY_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, productId }),
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to subscribe: ${await readErrorReason(response)}.`)
  }
}

export async function toggleBroadcastSubscription(
  initData: string,
  allowBroadcasts?: boolean,
): Promise<{ ok: boolean; allowBroadcasts: boolean }> {
  const response = await fetch(
    import.meta.env.VITE_TOGGLE_BROADCAST_URL ?? DEFAULT_TOGGLE_BROADCAST_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, allowBroadcasts }),
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to toggle broadcast subscription: ${await readErrorReason(response)}.`)
  }

  const result = await response.json() as { ok: boolean; allowBroadcasts: boolean }

  return result
}

export async function unsubscribeFromProductNotify(
  initData: string,
  productId: string,
): Promise<void> {
  const response = await fetch(
    import.meta.env.VITE_UNSUBSCRIBE_NOTIFY_URL ?? DEFAULT_UNSUBSCRIBE_NOTIFY_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, productId }),
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to unsubscribe: ${await readErrorReason(response)}.`)
  }
}
