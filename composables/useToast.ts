import { ref } from 'vue';

export interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  title?: string;
  message: string;
  action?: ToastAction;
}

interface ToastTimerState {
  timer: ReturnType<typeof setTimeout> | null;
  remainingMs: number;
  startedAt: number;
}

const toasts = ref<ToastItem[]>([]);
const timers = new Map<string, ToastTimerState>();

export function useToast() {
  function startTimer(id: string, durationMs: number) {
    const existing = timers.get(id);
    if (existing?.timer) {
      clearTimeout(existing.timer);
    }

    const timer = setTimeout(() => {
      remove(id);
    }, durationMs);

    timers.set(id, {
      timer,
      remainingMs: durationMs,
      startedAt: Date.now(),
    });
  }

  function add(options: {
    severity?: 'success' | 'error' | 'info';
    summary?: string;
    detail?: string;
    message?: string;
    life?: number;
    action?: ToastAction;
  }): string {
    const id = crypto.randomUUID();
    const type = options.severity === 'error' ? 'error' : options.severity === 'info' ? 'info' : 'success';
    const message = options.detail || options.message || options.summary || '';
    const title = options.summary && options.summary !== message ? options.summary : undefined;

    toasts.value.push({ id, type, title, message, action: options.action });

    const timeout = options.life ?? (options.action ? 5000 : 3500);
    startTimer(id, timeout);

    return id;
  }

  function pause(id: string) {
    const state = timers.get(id);
    if (!state?.timer) {
      return;
    }
    clearTimeout(state.timer);
    const elapsed = Date.now() - state.startedAt;
    state.remainingMs = Math.max(0, state.remainingMs - elapsed);
    state.timer = null;
  }

  function resume(id: string) {
    const state = timers.get(id);
    if (!state) {
      return;
    }
    if (state.timer != null || !toasts.value.some((t) => t.id === id)) {
      return;
    }
    if (state.remainingMs <= 0) {
      remove(id);
      return;
    }
    startTimer(id, state.remainingMs);
  }

  async function triggerAction(id: string) {
    const toast = toasts.value.find((t) => t.id === id);
    if (!toast?.action) {
      return;
    }
    const { onClick } = toast.action;
    remove(id);
    await onClick();
  }

  function remove(id: string) {
    const state = timers.get(id);
    if (state?.timer) {
      clearTimeout(state.timer);
    }
    timers.delete(id);
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return {
    toasts,
    add,
    pause,
    resume,
    triggerAction,
    remove,
  };
}
