// ── Consent & User Settings Module ──
// Handles GDPR consent acceptance, checking consent status, and user settings
// (leaderboard visibility, broadcast preferences).

import { onRequest } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'
import {
  telegramBotToken,
  verifyTelegramInitData,
} from './helpers.js'

// ── Types ──

type ConsentRequest = {
  initData: string
  accept?: boolean
  check?: boolean
  withdraw?: boolean
}

type ConsentResponse = {
  ok: boolean
  hasAcceptedTerms: boolean
  reason?:
    | 'accepted'
    | 'already_accepted'
    | 'checked'
    | 'withdrawn'
    | 'invalid_method'
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
    | 'internal_error'
  detail?: string
}

type SettingsRequest = {
  initData: string
  get?: boolean
  leaderboardShown?: boolean
}

type SettingsResponse = {
  ok: boolean
  leaderboardShown: boolean
  allowBroadcasts: boolean
  hasAcceptedTerms: boolean
  reason?:
    | 'updated'
    | 'listed'
    | 'invalid_method'
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
    | 'internal_error'
  detail?: string
}

// ── Constants ──

const USER_CONSENT_COLLECTION = 'userConsent'
const USER_SETTINGS_COLLECTION = 'userSettings'

// ── Accept or Check Terms of Service / Privacy Policy ──

export const acceptTermsHandler = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        hasAcceptedTerms: false,
        reason: 'invalid_method',
      } satisfies ConsentResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        hasAcceptedTerms: false,
        reason: 'missing_bot_token',
      } satisfies ConsentResponse)
      return
    }

    const body = request.body as Partial<ConsentRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const accept = body?.accept === true
    const check = body?.check === true
    const withdraw = body?.withdraw === true

    if (!accept && !check && !withdraw) {
      response.status(400).json({
        ok: false,
        hasAcceptedTerms: false,
        reason: 'invalid_method',
        detail: 'Request must specify "accept: true", "check: true", or "withdraw: true".',
      } satisfies ConsentResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        hasAcceptedTerms: false,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies ConsentResponse)
      return
    }

    const telegramUserId = verificationResult.user.id
    const db = getFirestore()
    const consentDocRef = db.collection(USER_CONSENT_COLLECTION).doc(String(telegramUserId))

    try {
      // ── Check mode ──
      if (check) {
        const snapshot = await consentDocRef.get()
        const hasAcceptedTerms = snapshot.exists && snapshot.data()?.hasAcceptedTerms === true

        response.status(200).json({
          ok: true,
          hasAcceptedTerms,
          reason: 'checked',
        } satisfies ConsentResponse)
        return
      }

      // ── Withdraw mode ──
      if (withdraw) {
        await consentDocRef.set({
          telegramUserId,
          hasAcceptedTerms: false,
          withdrawnAt: new Date().toISOString(),
        }, { merge: true })

        response.status(200).json({
          ok: true,
          hasAcceptedTerms: false,
          reason: 'withdrawn',
        } satisfies ConsentResponse)
        return
      }

      // ── Accept mode ──
      // Check if already accepted
      const existingSnapshot = await consentDocRef.get()
      if (existingSnapshot.exists && existingSnapshot.data()?.hasAcceptedTerms === true) {
        response.status(200).json({
          ok: true,
          hasAcceptedTerms: true,
          reason: 'already_accepted',
        } satisfies ConsentResponse)
        return
      }

      // Save consent to Firestore
      await consentDocRef.set({
        telegramUserId,
        hasAcceptedTerms: true,
        acceptedAt: new Date().toISOString(),
        ipAddress: request.headers['x-forwarded-for'] || request.ip || null,
        userAgent: request.headers['user-agent'] || null,
      })

      // Also create or update userSettings document with defaults
      const settingsDocRef = db.collection(USER_SETTINGS_COLLECTION).doc(String(telegramUserId))
      const settingsSnapshot = await settingsDocRef.get()
      if (!settingsSnapshot.exists) {
        await settingsDocRef.set({
          telegramUserId,
          leaderboardShown: true,
          allowBroadcasts: false, // Default: opt-out for broadcasts
          updatedAt: new Date().toISOString(),
        })
      }

      response.status(200).json({
        ok: true,
        hasAcceptedTerms: true,
        reason: 'accepted',
      } satisfies ConsentResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        hasAcceptedTerms: false,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies ConsentResponse)
    }
  },
)

// ── Get or Update User Settings (leaderboard visibility, broadcast) ──

export const updateUserSettingsHandler = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        leaderboardShown: false,
        allowBroadcasts: false,
        hasAcceptedTerms: false,
        reason: 'invalid_method',
      } satisfies SettingsResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        leaderboardShown: false,
        allowBroadcasts: false,
        hasAcceptedTerms: false,
        reason: 'missing_bot_token',
      } satisfies SettingsResponse)
      return
    }

    const body = request.body as Partial<SettingsRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const isGetRequest = body?.get === true
    const leaderboardShown = body?.leaderboardShown

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        leaderboardShown: false,
        allowBroadcasts: false,
        hasAcceptedTerms: false,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies SettingsResponse)
      return
    }

    const telegramUserId = verificationResult.user.id
    const db = getFirestore()

    try {
      // ── Get mode ──
      if (isGetRequest) {
        // Get settings
        const settingsDocRef = db.collection(USER_SETTINGS_COLLECTION).doc(String(telegramUserId))
        const settingsSnapshot = await settingsDocRef.get()

        // Get consent status
        const consentDocRef = db.collection(USER_CONSENT_COLLECTION).doc(String(telegramUserId))
        const consentSnapshot = await consentDocRef.get()
        const hasAcceptedTerms = consentSnapshot.exists && consentSnapshot.data()?.hasAcceptedTerms === true

        if (!settingsSnapshot.exists) {
          response.status(200).json({
            ok: true,
            leaderboardShown: true,
            allowBroadcasts: false,
            hasAcceptedTerms,
            reason: 'listed',
          } satisfies SettingsResponse)
          return
        }

        const settingsData = settingsSnapshot.data() as {
          leaderboardShown?: boolean
          allowBroadcasts?: boolean
        } | undefined

        response.status(200).json({
          ok: true,
          leaderboardShown: settingsData?.leaderboardShown !== false,
          allowBroadcasts: settingsData?.allowBroadcasts === true,
          hasAcceptedTerms,
          reason: 'listed',
        } satisfies SettingsResponse)
        return
      }

      // ── Update mode: update leaderboard visibility ──
      if (leaderboardShown !== undefined) {
        const settingsDocRef = db.collection(USER_SETTINGS_COLLECTION).doc(String(telegramUserId))

        await settingsDocRef.set(
          {
            telegramUserId,
            leaderboardShown: leaderboardShown === true,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        )

        // Fetch the merged result to return current state
        const updatedSnapshot = await settingsDocRef.get()
        const updatedData = updatedSnapshot.data() as {
          leaderboardShown?: boolean
          allowBroadcasts?: boolean
        } | undefined

        response.status(200).json({
          ok: true,
          leaderboardShown: updatedData?.leaderboardShown !== false,
          allowBroadcasts: updatedData?.allowBroadcasts === true,
          hasAcceptedTerms: true,
          reason: 'updated',
        } satisfies SettingsResponse)
        return
      }

      // ── No valid operation specified ──
      response.status(400).json({
        ok: false,
        leaderboardShown: false,
        allowBroadcasts: false,
        hasAcceptedTerms: false,
        reason: 'invalid_method',
        detail: 'Request must specify "get: true" or "leaderboardShown: boolean".',
      } satisfies SettingsResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        leaderboardShown: false,
        allowBroadcasts: false,
        hasAcceptedTerms: false,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies SettingsResponse)
    }
  },
)
