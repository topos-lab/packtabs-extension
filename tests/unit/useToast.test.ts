/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useToast } from '../../composables/useToast';

describe('useToast composable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const { toasts, remove } = useToast();
    [...toasts.value].forEach((t) => remove(t.id));
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('defaults action toasts to 5000ms, pauses/resumes on hover, and fires action once via triggerAction', async () => {
    const onUndo = vi.fn().mockResolvedValue(undefined);
    const { toasts, add, pause, resume, triggerAction } = useToast();

    const id = add({
      severity: 'success',
      detail: 'Deleted',
      action: { label: 'Undo', onClick: onUndo },
    });

    // Should still be alive after 3500ms because action toasts default to 5000ms
    vi.advanceTimersByTime(3500);
    expect(toasts.value.some((t) => t.id === id)).toBe(true);

    // Pause with 1500ms left
    pause(id);
    vi.advanceTimersByTime(5000);
    expect(toasts.value.some((t) => t.id === id)).toBe(true);

    // Resume and advance 1000ms -> still visible; then trigger action
    resume(id);
    vi.advanceTimersByTime(1000);
    expect(toasts.value.some((t) => t.id === id)).toBe(true);

    await triggerAction(id);
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(toasts.value.some((t) => t.id === id)).toBe(false);
  });
});
