import { useEffect, useRef, useState } from 'react'
import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  onSnapshot,
} from 'firebase/firestore'

import { getFirestoreDb } from '../lib/firebase/firestore'

const PRESENCE_COLLECTION = 'presence'
const HEARTBEAT_INTERVAL_MS = 60_000 // 1 minute
const ACTIVE_WINDOW_MS = 5 * 60_000 // 5 minutes

/**
 * Tracks online users using Firestore presence.
 *
 * - Writes a `lastSeen` timestamp to `presence/{telegramUserId}` on mount
 * - Sends heartbeats every 60s while the component is mounted
 * - Uses `onSnapshot` to read all presence docs and filters client-side for
 *   users with `lastSeen` within the last 5 minutes
 * - Cleans up on unmount
 */
export function useOnlineUsers(telegramUserId?: number): number {
  const db = getFirestoreDb()
  const [onlineCount, setOnlineCount] = useState(0)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const userIdRef = useRef(telegramUserId)
  userIdRef.current = telegramUserId

  // Write heartbeat to Firestore
  const writeHeartbeat = async () => {
    const uid = userIdRef.current
    if (!db || !uid) return

    try {
      const presenceRef = doc(db, PRESENCE_COLLECTION, String(uid))
      await setDoc(
        presenceRef,
        { lastSeen: serverTimestamp() },
        { merge: true },
      )
    } catch {
      // Silent fail — presence is progressive enhancement
    }
  }

  // Send heartbeat on mount and periodically
  useEffect(() => {
    if (!db || !telegramUserId) return

    // Write initial heartbeat
    void writeHeartbeat()

    // Set up periodic heartbeat
    heartbeatRef.current = setInterval(() => {
      void writeHeartbeat()
    }, HEARTBEAT_INTERVAL_MS)

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, telegramUserId])

  // Listen for active users in realtime — filter client-side to avoid stale cutoff
  useEffect(() => {
    if (!db) {
      setOnlineCount(0)
      return
    }

    const presenceQuery = query(collection(db, PRESENCE_COLLECTION))

    const unsubscribe = onSnapshot(
      presenceQuery,
      (snapshot) => {
        const now = Date.now()
        let count = 0
        snapshot.forEach((doc) => {
          const data = doc.data()
          const lastSeen = data.lastSeen
          if (lastSeen && typeof lastSeen.toMillis === 'function') {
            if (lastSeen.toMillis() > now - ACTIVE_WINDOW_MS) {
              count++
            }
          }
        })
        setOnlineCount(count)
      },
      () => {
        // Silent fail on permission errors — presence is progressive enhancement
        setOnlineCount(0)
      },
    )

    return () => {
      unsubscribe()
    }
  }, [db])

  return onlineCount
}
