/**
 * Firestore operations for user consent, leaderboard visibility, and settings.
 * All writes go through Cloud Functions (not direct Firestore client access) for security.
 */

// ── API endpoint URLs ──

const DEFAULT_CONSENT_URL = '/api/user/consent'
const DEFAULT_USER_SETTINGS_URL = '/api/user/settings'
const DEFAULT_SETTINGS_URL = '/api/user/settings'

// ── Error reading helper ──

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

// ── Types ──

export type AcceptTermsResult = {
  ok: boolean
  hasAcceptedTerms: boolean
  reason?: string
}

export type UserSettingsResult = {
  ok: boolean
  leaderboardShown: boolean
  allowBroadcasts: boolean
  hasAcceptedTerms: boolean
  reason?: string
}

// ── Withdraw consent (revoke acceptance) ──

export async function withdrawConsent(
  initData: string,
): Promise<AcceptTermsResult> {
  const response = await fetch(
    import.meta.env.VITE_USER_CONSENT_URL ?? DEFAULT_CONSENT_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, withdraw: true }),
    },
  )

  if (!response.ok) {
    return { ok: false, hasAcceptedTerms: false, reason: await readErrorReason(response) }
  }

  const result = (await response.json()) as AcceptTermsResult
  return {
    ok: result.ok === true,
    hasAcceptedTerms: result.hasAcceptedTerms === true,
    reason: result.reason,
  }
}

// ── Accept terms of service / privacy policy ──

export async function acceptTerms(
  initData: string,
): Promise<AcceptTermsResult> {
  const response = await fetch(
    import.meta.env.VITE_USER_CONSENT_URL ?? DEFAULT_CONSENT_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, accept: true }),
    },
  )

  if (!response.ok) {
    return { ok: false, hasAcceptedTerms: false, reason: await readErrorReason(response) }
  }

  const result = (await response.json()) as AcceptTermsResult
  return {
    ok: result.ok === true,
    hasAcceptedTerms: result.hasAcceptedTerms === true,
    reason: result.reason,
  }
}

// ── Check if user has accepted terms ──

export async function checkTermsAccepted(
  initData: string,
): Promise<boolean> {
  try {
    const response = await fetch(
      import.meta.env.VITE_USER_CONSENT_URL ?? DEFAULT_CONSENT_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, check: true }),
      },
    )

    if (!response.ok) return false

    const result = (await response.json()) as UserSettingsResult
    return result.hasAcceptedTerms === true
  } catch {
    return false
  }
}

// ── Toggle leaderboard visibility ──

export async function toggleLeaderboardVisibility(
  initData: string,
  showInLeaderboard: boolean,
): Promise<{ ok: boolean; leaderboardShown: boolean }> {
  const response = await fetch(
    import.meta.env.VITE_USER_SETTINGS_URL ?? DEFAULT_USER_SETTINGS_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, leaderboardShown: showInLeaderboard }),
    },
  )

  if (!response.ok) {
    return { ok: false, leaderboardShown: !showInLeaderboard }
  }

  const result = (await response.json()) as { ok: boolean; leaderboardShown: boolean }
  return { ok: result.ok === true, leaderboardShown: result.leaderboardShown === true }
}

// ── Get user settings (consent + leaderboard + broadcast) ──

export async function getUserSettings(
  initData: string,
): Promise<UserSettingsResult> {
  const response = await fetch(
    import.meta.env.VITE_USER_SETTINGS_URL ?? DEFAULT_SETTINGS_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, get: true }),
    },
  )

  if (!response.ok) {
    return {
      ok: false,
      leaderboardShown: true,
      allowBroadcasts: true,
      hasAcceptedTerms: false,
      reason: await readErrorReason(response),
    }
  }

  const result = (await response.json()) as UserSettingsResult
  return {
    ok: result.ok === true,
    leaderboardShown: result.leaderboardShown !== false,
    allowBroadcasts: result.allowBroadcasts !== false,
    hasAcceptedTerms: result.hasAcceptedTerms === true,
    reason: result.reason,
  }
}
