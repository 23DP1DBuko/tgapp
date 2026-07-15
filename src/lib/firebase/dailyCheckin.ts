import { withRetry, isTransientError, fetchWithTimeout } from '../retry'

const DEFAULT_CHECKIN_URL = '/api/checkin/daily'
const DEFAULT_CHECKIN_STATUS_URL = '/api/checkin/status'

export type CheckinResult = {
  ok: boolean
  currentStreak: number
  longestStreak: number
  totalCheckIns: number
  todayCheckedIn: boolean
  rewardGranted: boolean
  rewardCode: string | null
  milestoneLabel: string | null
  reason: string
}

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

export async function checkIn(initData: string): Promise<CheckinResult> {
  return withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_CHECKIN_URL || DEFAULT_CHECKIN_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      },
    )

    if (!response.ok) {
      return {
        ok: false,
        currentStreak: 0,
        longestStreak: 0,
        totalCheckIns: 0,
        todayCheckedIn: false,
        rewardGranted: false,
        rewardCode: null,
        milestoneLabel: null,
        reason: await readErrorReason(response),
      }
    }

    const result = (await response.json()) as CheckinResult

    return {
      ok: result.ok,
      currentStreak: result.currentStreak ?? 0,
      longestStreak: result.longestStreak ?? 0,
      totalCheckIns: result.totalCheckIns ?? 0,
      todayCheckedIn: result.todayCheckedIn ?? false,
      rewardGranted: result.rewardGranted ?? false,
      rewardCode: result.rewardCode ?? null,
      milestoneLabel: result.milestoneLabel ?? null,
      reason: result.reason ?? 'unknown',
    }
  }, { maxRetries: 1, shouldRetry: isTransientError })
}

export async function fetchCheckinStatus(initData: string): Promise<CheckinResult> {
  return withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_CHECKIN_STATUS_URL || DEFAULT_CHECKIN_STATUS_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      },
    )

    if (!response.ok) {
      return {
        ok: false,
        currentStreak: 0,
        longestStreak: 0,
        totalCheckIns: 0,
        todayCheckedIn: false,
        rewardGranted: false,
        rewardCode: null,
        milestoneLabel: null,
        reason: await readErrorReason(response),
      }
    }

    const result = (await response.json()) as CheckinResult

    return {
      ok: result.ok,
      currentStreak: result.currentStreak ?? 0,
      longestStreak: result.longestStreak ?? 0,
      totalCheckIns: result.totalCheckIns ?? 0,
      todayCheckedIn: result.todayCheckedIn ?? false,
      rewardGranted: false,
      rewardCode: null,
      milestoneLabel: null,
      reason: result.reason ?? 'unknown',
    }
  }, { maxRetries: 1, shouldRetry: isTransientError })
}
