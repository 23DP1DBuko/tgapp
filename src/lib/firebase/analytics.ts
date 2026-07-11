const DEFAULT_ADMIN_ANALYTICS_URL = '/api/admin/analytics'

export type AnalyticsResult = {
  totalUsers: number
  itemsSold: number
  grossRevenueEur: number
  referralCount: number
}

type AdminAnalyticsResponse = AnalyticsResult & {
  ok?: boolean
  reason?: string
  detail?: string
}

async function readErrorReason(response: Response): Promise<string> {
  let reason = `http_${response.status}`
  let detail = ''

  try {
    const result = (await response.json()) as { reason?: string; detail?: string }
    if (typeof result.reason === 'string') reason = result.reason
    if (typeof result.detail === 'string' && result.detail) detail = result.detail
  } catch {
    // Keep HTTP fallback.
  }

  return `${reason}${detail ? ` (${detail})` : ''}`
}

export async function fetchAdminAnalytics(
  initData: string,
): Promise<AnalyticsResult> {
  const response = await fetch(
    import.meta.env.VITE_ADMIN_ANALYTICS_URL ??
      DEFAULT_ADMIN_ANALYTICS_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to load analytics: ${await readErrorReason(response)}.`)
  }

  const result = (await response.json()) as AdminAnalyticsResponse

  if (!result.ok) {
    throw new Error(
      `Failed to load analytics: ${result.reason ?? 'invalid response'}.`,
    )
  }

  return {
    totalUsers: result.totalUsers ?? 0,
    itemsSold: result.itemsSold ?? 0,
    grossRevenueEur: result.grossRevenueEur ?? 0,
    referralCount: result.referralCount ?? 0,
  }
}
