/**
 * Tiny app-wide toast helper.
 *
 * Usage:
 *   import { toast } from '../utils/toast'
 *   toast('Saved!', 'ok')
 */

export function toast(message, tone = 'ok') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, tone } }))
}
