import { useCallback, useEffect, useRef, useState } from 'react'

import { reserveProduct, releaseProductReservation } from '../lib/firebase/products'

const RESERVATION_RETRY_DELAY_MS = 10_000

export type ReservationStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'reserved'; reservedUntil: Date; remainingMs: number }
  | { kind: 'already_yours'; reservedUntil: Date; remainingMs: number }
  | { kind: 'already_reserved'; reservedUntil: Date | null }
  | { kind: 'unavailable' }
  | { kind: 'error'; message: string }

export type UseProductReservationResult = {
  reservationStatus: ReservationStatus
  releaseReservation: () => Promise<void>
}

/**
 * Manages product reservation lifecycle.
 * - Reserves the product on mount (if available)
 * - Shows countdown timer while reserved
 * - Auto-releases on unmount (if a reservation was successfully made)
 * - Retries on error/idle states via a re-triggering effect
 */
export function useProductReservation(
  initData: string,
  productId: string,
  isAvailable: boolean,
): UseProductReservationResult {
  const [reservationStatus, setReservationStatus] = useState<ReservationStatus>({
    kind: 'idle',
  })
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasReservationRef = useRef(false)

  // ── Update countdown every second ──

  const clearCountdown = useCallback(() => {
    if (countdownIntervalRef.current !== null) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
  }, [])

  const startCountdown = useCallback(
    (reservedUntil: Date) => {
      clearCountdown()

      function tick() {
        const now = Date.now()
        const remaining = reservedUntil.getTime() - now

        if (remaining <= 0) {
          clearCountdown()
          setReservationStatus({ kind: 'idle' })
          hasReservationRef.current = false
          return
        }

        setReservationStatus((prev) => {
          if (prev.kind !== 'reserved' && prev.kind !== 'already_yours') {
            return prev
          }
          return { ...prev, remainingMs: remaining }
        })
      }

      tick()
      countdownIntervalRef.current = setInterval(tick, 1000)
    },
    [clearCountdown],
  )

  // ── Core reservation logic (extracted to avoid closure issues) ──

  const attemptReserve = useCallback(async () => {
    if (!initData || !productId || !isAvailable) return

    setReservationStatus({ kind: 'loading' })

    try {
      const result = await reserveProduct(initData, productId)

      if (result.reserved && result.reservedUntil) {
        const reservedUntilDate = new Date(result.reservedUntil)
        const remaining = reservedUntilDate.getTime() - Date.now()

        if (remaining <= 0) {
          setReservationStatus({ kind: 'idle' })
          return
        }

        hasReservationRef.current = true
        setReservationStatus({
          kind: result.reason === 'already_yours' ? 'already_yours' : 'reserved',
          reservedUntil: reservedUntilDate,
          remainingMs: remaining,
        })
        startCountdown(reservedUntilDate)
      } else if (result.reason === 'already_reserved') {
        setReservationStatus({
          kind: 'already_reserved',
          reservedUntil: result.reservedUntil ? new Date(result.reservedUntil) : null,
        })
      } else if (result.reason === 'product_unavailable') {
        setReservationStatus({ kind: 'unavailable' })
      } else {
        setReservationStatus({ kind: 'error', message: result.reason })
      }
    } catch (error) {
      setReservationStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Failed to reserve product.',
      })
    }
  }, [initData, productId, isAvailable, startCountdown])

  // ── Trigger initial reservation on mount ──

  useEffect(() => {
    if (!isAvailable || !initData || !productId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReservationStatus({ kind: 'idle' })
      return
    }

    hasReservationRef.current = false
    void attemptReserve()
  }, [initData, productId, isAvailable, attemptReserve])

  // ── Separate effect: retry on error/idle states after a delay ──

  useEffect(() => {
    if (reservationStatus.kind !== 'error' && reservationStatus.kind !== 'idle') {
      return
    }

    const timer = setTimeout(() => {
      void attemptReserve()
    }, RESERVATION_RETRY_DELAY_MS)

    return () => clearTimeout(timer)
  }, [reservationStatus.kind, attemptReserve])

  // ── Release on unmount ──

  useEffect(() => {
    return () => {
      clearCountdown()

      if (!hasReservationRef.current || !initData || !productId) {
        return
      }

      // Fire-and-forget release on unmount
      releaseProductReservation(initData, productId).catch(() => {
        // Best-effort
      })
    }
  }, [initData, productId, clearCountdown])

  // ── Manual release ──

  const handleRelease = useCallback(async () => {
    if (!initData || !productId) return

    clearCountdown()
    setReservationStatus({ kind: 'idle' })
    hasReservationRef.current = false

    try {
      await releaseProductReservation(initData, productId)
    } catch {
      // Best-effort
    }
  }, [initData, productId, clearCountdown])

  return {
    reservationStatus,
    releaseReservation: handleRelease,
  }
}
