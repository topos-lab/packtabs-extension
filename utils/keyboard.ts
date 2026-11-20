/**
 * Returns true while an Input Method Editor (IME) composition session is active.
 * Checks `isComposing`, the standard `'Process'` key value, and legacy WebKit/Safari IME `keyCode === 229`.
 */
export function isImeComposing(event: KeyboardEvent): boolean {
  return event.isComposing || event.key === 'Process' || Reflect.get(event, 'keyCode') === 229;
}
