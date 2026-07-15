/** Timeout for admin API calls (30 seconds). */
export const ADMIN_FETCH_TIMEOUT_MS = 30_000

/**
 * Wraps `fetch` with an AbortController timeout.
 * Throws an `AbortError` (DOMException with name `'AbortError'`) on timeout.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = ADMIN_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Returns true when the error is an AbortError (request timed out).
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/**
 * Categorises an error from an admin API operation.
 */
export type AdminErrorKind = 'timeout' | 'network' | 'server' | 'validation' | 'unknown'

export function classifyAdminError(error: unknown): AdminErrorKind {
  if (isAbortError(error)) return 'timeout'

  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return 'network'
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase()

    if (msg.startsWith('http_5')) return 'server'
    if (msg.startsWith('http_4')) return 'validation'
    if (msg.includes('timeout')) return 'timeout'
    if (msg.includes('network') || msg.includes('econnrefused') || msg.includes('econnreset') || msg.includes('enetunreach')) return 'network'
  }

  return 'unknown'
}

/**
 * Translates a categorised error into a user-friendly message for admin forms.
 */
export function formatAdminErrorMessage(kind: AdminErrorKind, error: unknown): string {
  switch (kind) {
    case 'timeout':
      return 'The request timed out. The server may be busy — please try again.'
    case 'network':
      return 'Network error. Check your internet connection and try again.'
    case 'server':
      return 'The server encountered an error. Please try again in a moment.'
    case 'validation':
      return error instanceof Error ? error.message : 'Invalid input. Please review your form.'
    case 'unknown':
      return error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'
  }
}

/**
 * Retry configuration options.
 */
export type RetryOptions = {
  /** Maximum number of retry attempts (default 3). */
  maxRetries?: number
  /** Base delay in milliseconds before the first retry (default 1000ms). */
  baseDelayMs?: number
  /** Backoff multiplier applied after each retry (default 2). */
  backoffMultiplier?: number
  /** Optional predicate to decide if a given error should trigger a retry.
   *  If omitted, all errors trigger retries. */
  shouldRetry?: (error: unknown) => boolean
}

const defaults: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  backoffMultiplier: 2,
  shouldRetry: () => true,
}

/**
 * Wraps an async operation with automatic retry logic using exponential backoff.
 *
 * Retries only when `options.shouldRetry` returns true (default: all errors).
 * Jitter is added to prevent thundering herd on reconnection.
 *
 * @example
 * const data = await withRetry(() => fetchData(), { maxRetries: 3 })
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxRetries, baseDelayMs, backoffMultiplier, shouldRetry } = {
    ...defaults,
    ...options,
  }

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt >= maxRetries || !shouldRetry(error)) {
        break
      }

      // Exponential backoff with jitter (±50%)
      const delay = baseDelayMs * Math.pow(backoffMultiplier, attempt)
      const jitter = delay * (0.5 + Math.random() * 0.5)

      await new Promise((resolve) => setTimeout(resolve, jitter))
    }
  }

  throw lastError
}

/**
 * Network-aware shouldRetry predicate.
 * Only retries when the browser reports being online
 * or when the error looks like a transient network failure.
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return true
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return (
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('abort') ||
      msg.includes('econnrefused') ||
      msg.includes('econnreset') ||
      msg.includes('enetunreach') ||
      msg.includes('http_5') || // 5xx server errors
      msg.includes('http_503') ||
      msg.includes('http_502') ||
      msg.includes('http_504')
    )
  }

  return false
}
