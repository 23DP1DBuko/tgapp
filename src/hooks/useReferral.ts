import { useEffect, useState } from 'react'

import { fetchReferralInfo } from '../lib/firebase/referral'
import type { ReferralInfoResult, RewardMilestone } from '../lib/firebase/referral'

export type UseReferralResult = {
  referralInfo: ReferralInfoResult | null
  isLoading: boolean
  referralLink: string
  rewardMilestones: RewardMilestone[]
}

export function useReferral(initData: string): UseReferralResult {
  const [referralInfo, setReferralInfo] = useState<ReferralInfoResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!initData) return

    let isCancelled = false

    async function load() {
      setIsLoading(true)
      try {
        const info = await fetchReferralInfo(initData)
        if (!isCancelled) setReferralInfo(info)
      } catch {
        // Silently fail — referral feature is progressive enhancement
      } finally {
        if (!isCancelled) setIsLoading(false)
      }
    }

    void load()
    return () => { isCancelled = true }
  }, [initData])

  const referralLink = buildReferralLink(referralInfo?.referralCode ?? null)

  const rewardMilestones = referralInfo?.rewardMilestones ?? []

  return { referralInfo, isLoading, referralLink, rewardMilestones }
}

function buildReferralLink(referralCode: string | null): string {
  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME?.trim()

  if (botUsername && referralCode) {
    const normalizedBotUsername = botUsername.replace(/^@/, '')
    return `https://t.me/${normalizedBotUsername}?start=${encodeURIComponent(referralCode)}`
  }

  return ''
}
