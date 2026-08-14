// ── Online Presence Module ──
// Server-verified heartbeat so the live online-user counter can never be
// spoofed by writing fake presence docs (M6). The `presence` collection is
// read-only from the client; only this function writes `lastSeen`.
//
// The heartbeat runs every 60s per active user (one call per minute), which is
// negligible for a small community app and is the only way to bind the write to
// the HMAC-verified Telegram identity.

import { onRequest } from 'firebase-functions/v2/https'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import {
  telegramBotToken,
  verifyTelegramInitData,
} from './helpers.js'

// ── Types ──

export type UpdatePresenceResponse = {
  ok: boolean
  detail?: string
  reason:
    | 'updated'
    | 'invalid_method'
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
    | 'internal_error'
}

// ── Heartbeat write ──

/**
 * Write the heartbeat for a verified user (exposed for unit tests).
 *
 * Doc id is the stringified user id, so each user can only ever touch their own
 * presence doc; the write is transactional (reads the doc first), mirroring the
 * codebase's other tested server writes.
 */
export async function writePresenceHeartbeat(
  db: FirebaseFirestore.Firestore,
  telegramUserId: number,
): Promise<void> {
  const presenceRef = db.collection('presence').doc(String(telegramUserId))

  await db.runTransaction(async (transaction) => {
    await transaction.get(presenceRef)
    transaction.set(
      presenceRef,
      { lastSeen: FieldValue.serverTimestamp() },
      { merge: true },
    )
  })
}

// ── Handler ──

export const updatePresence = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        reason: 'invalid_method',
      } satisfies UpdatePresenceResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        reason: 'missing_bot_token',
      } satisfies UpdatePresenceResponse)
      return
    }

    const body = request.body as Partial<{ initData: string }> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies UpdatePresenceResponse)
      return
    }

    try {
      await writePresenceHeartbeat(getFirestore(), verificationResult.user.id)

      response.status(200).json({
        ok: true,
        reason: 'updated',
      } satisfies UpdatePresenceResponse)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown backend error.'

      response.status(500).json({
        ok: false,
        reason: 'internal_error',
        detail,
      } satisfies UpdatePresenceResponse)
    }
  },
)
