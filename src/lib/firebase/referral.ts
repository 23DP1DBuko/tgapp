const DEFAULT_REFERRAL_INFO_URL = '/api/referral/info'

export type RewardMilestone = {
  threshold: number
  discountPercent: number
  promoCode: string
  granted: boolean
}

export type ReferralInfoResult = {
  referralCode: string | null
  referralCount: number
  telegramUserId: number | null
  rewardMilestones: RewardMilestone[]
}

type ReferralInfoResponse = ReferralInfoResult & {
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

export async function fetchReferralInfo(
  initData: string,
): Promise<ReferralInfoResult> {
  const response = await fetch(
    import.meta.env.VITE_REFERRAL_INFO_URL ?? DEFAULT_REFERRAL_INFO_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to load referral info: ${await readErrorReason(response)}.`)
  }

  const result = (await response.json()) as ReferralInfoResponse

  if (!result.ok) {
    throw new Error(
      `Failed to load referral info: ${result.reason ?? 'invalid response'}.`,
    )
  }

  return {
    referralCode: result.referralCode ?? null,
    referralCount: result.referralCount ?? 0,
    telegramUserId: result.telegramUserId ?? null,
    rewardMilestones: Array.isArray(result.rewardMilestones)
      ? result.rewardMilestones.map((m) => ({
          threshold: m.threshold ?? 0,
          discountPercent: m.discountPercent ?? 0,
          promoCode: m.promoCode ?? '',
          granted: Boolean(m.granted),
        }))
      : [],
  }
}

// ── Referral Leaderboard ──

const DEFAULT_REFERRAL_LEADERBOARD_URL = '/api/referral/leaderboard'

export type ReferralLeaderboardEntry = {
  rank: number
  telegramUserId: number
  username: string | null
  referralCount: number
}

export type ReferralLeaderboardResult = {
  topReferrers: ReferralLeaderboardEntry[]
  myRank: number | null
  myReferralCount: number
}

type ReferralLeaderboardResponse = ReferralLeaderboardResult & {
  ok?: boolean
  reason?: string
  detail?: string
}

export async function fetchReferralLeaderboard(
  initData: string,
): Promise<ReferralLeaderboardResult> {
  const response = await fetch(
    import.meta.env.VITE_REFERRAL_LEADERBOARD_URL ?? DEFAULT_REFERRAL_LEADERBOARD_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    },
  )

  if (!response.ok) {
    return { topReferrers: [], myRank: null, myReferralCount: 0 }
  }

  const result = (await response.json()) as ReferralLeaderboardResponse

  if (!result.ok) {
    return { topReferrers: [], myRank: null, myReferralCount: 0 }
  }

  return {
    topReferrers: Array.isArray(result.topReferrers) ? result.topReferrers : [],
    myRank: result.myRank ?? null,
    myReferralCount: result.myReferralCount ?? 0,
  }
}
