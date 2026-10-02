/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useToast } from '../../composables/useToast';

describe('useToast composable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should add toast and auto-remove after timeout', () => {
    const { toasts, add } = useToast();

    const id = add({
      severity: 'success',
      summary: 'Success Message',
      life: 2000,
    });

    expect(typeof id).toBe('string');
    expect(toasts.value.some((t) => t.id === id)).toBe(true);

    vi.advanceTimersByTime(2000);

    expect(toasts.value.some((t) => t.id === id)).toBe(false);
  });

  it('should allow manual removal before timeout and clear timer', () => {
    const { toasts, add, remove } = useToast();

    const id = add({
      severity: 'error',
      message: 'Error Message',
      life: 5000,
    });

    expect(toasts.value.some((t) => t.id === id)).toBe(true);

    remove(id);

    expect(toasts.value.some((t) => t.id === id)).toBe(false);

    // Advancing timers should not cause errors
    vi.advanceTimersByTime(5000);
    expect(toasts.value.some((t) => t.id === id)).toBe(false);
  });
});
