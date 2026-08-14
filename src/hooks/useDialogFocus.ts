import { useEffect, useRef } from 'react'

/**
 * Minimal accessible focus management for modal dialogs / bottom sheets.
 *
 * While open:
 * - remembers the element that opened the dialog (so focus can return),
 * - moves focus into the dialog container (must have `tabIndex={-1}`),
 * - traps Tab / Shift+Tab inside the dialog's focusable elements,
 *
 * On close (or unmount) focus is restored to the opener. The container
 * element must be rendered when `isOpen` is true.
 */
export function useDialogFocus<T extends HTMLElement>(
  isOpen: boolean,
  ref: React.RefObject<T | null>,
): void {
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const dialog = ref.current
    if (!dialog) return

    // Remember who opened the dialog (before we steal focus).
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    dialog.focus({ preventScroll: true })

    function handleTab(event: KeyboardEvent) {
      if (event.key !== 'Tab') return

      // Read fresh from the ref: the dialog can be animating out while the
      // trap is still attached, and TS can't narrow the outer const here.
      const dialogEl = ref.current
      if (!dialogEl) return

      const focusables = Array.from(
        dialogEl.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null)

      if (focusables.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusables[0]
      const last = focusables[focusables.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleTab)

    return () => {
      document.removeEventListener('keydown', handleTab)
      restoreFocusRef.current?.focus({ preventScroll: true })
      restoreFocusRef.current = null
    }
  }, [isOpen, ref])
}
