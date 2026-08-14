import { useCallback, useEffect, useState } from 'react'

import { checkIn, fetchCheckinStatus } from '../lib/firebase/dailyCheckin'
import { translate } from '../lib/i18n/translate'

export type CheckinState = {
  currentStreak: number
  longestStreak: number
  totalCheckIns: number
  todayCheckedIn: boolean
  rewardGranted: boolean
  rewardCode: string | null
  milestoneLabel: string | null
}

export type UseDailyCheckinResult = {
  checkinState: CheckinState
  isLoading: boolean
  isCheckingIn: boolean
  handleCheckIn: () => Promise<void>
  feedback: string | null
}

const DEFAULT_STATE: CheckinState = {
  currentStreak: 0,
  longestStreak: 0,
  totalCheckIns: 0,
  todayCheckedIn: false,
  rewardGranted: false,
  rewardCode: null,
  milestoneLabel: null,
}

export function useDailyCheckin(initData: string): UseDailyCheckinResult {
  const [checkinState, setCheckinState] = useState<CheckinState>(DEFAULT_STATE)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  // Fetch status on mount
  useEffect(() => {
    if (!initData) return

    let cancelled = false

    async function load() {
      setIsLoading(true)
      try {
        const result = await fetchCheckinStatus(initData)
        if (!cancelled && result.ok) {
          setCheckinState({
            currentStreak: result.currentStreak,
            longestStreak: result.longestStreak,
            totalCheckIns: result.totalCheckIns,
            todayCheckedIn: result.todayCheckedIn,
            rewardGranted: false,
            rewardCode: null,
            milestoneLabel: null,
          })
        }
      } catch {
        // Silently fail — progressive enhancement
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [initData])

  // Clear feedback after 4 seconds
  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 4000)
    return () => clearTimeout(timer)
  }, [feedback])

  const handleCheckIn = useCallback(async () => {
    if (!initData || isCheckingIn) return

    setIsCheckingIn(true)
    try {
      const result = await checkIn(initData)

      if (result.ok) {
        setCheckinState({
          currentStreak: result.currentStreak,
          longestStreak: result.longestStreak,
          totalCheckIns: result.totalCheckIns,
          todayCheckedIn: true,
          rewardGranted: result.rewardGranted,
          rewardCode: result.rewardCode,
          milestoneLabel: result.milestoneLabel,
        })

        if (result.rewardGranted && result.milestoneLabel) {
          setFeedback(translate('checkin.streakReward', {
            n: result.currentStreak,
            label: result.milestoneLabel,
            code: result.rewardCode ?? '',
          }))
        } else {
          setFeedback(translate('checkin.streak', { n: result.currentStreak }))
        }
      } else if (result.reason === 'already_checked_in') {
        setCheckinState((prev) => ({ ...prev, todayCheckedIn: true }))
        setFeedback(translate('checkin.already'))
      } else {
        setFeedback(translate('checkin.failed'))
      }
    } catch {
      setFeedback(translate('checkin.network'))
    } finally {
      setIsCheckingIn(false)
    }
  }, [initData, isCheckingIn])

  return {
    checkinState,
    isLoading,
    isCheckingIn,
    handleCheckIn,
    feedback,
  }
}
