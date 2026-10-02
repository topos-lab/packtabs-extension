import { ref } from 'vue';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  title?: string;
  message: string;
}

const toasts = ref<ToastItem[]>([]);
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function useToast() {
  function add(options: {
    severity?: 'success' | 'error' | 'info';
    summary?: string;
    detail?: string;
    message?: string;
    life?: number;
  }): string {
    const id = crypto.randomUUID();
    const type = options.severity === 'error' ? 'error' : options.severity === 'info' ? 'info' : 'success';
    const message = options.detail || options.message || options.summary || '';
    const title = options.summary && options.summary !== message ? options.summary : undefined;

    toasts.value.push({ id, type, title, message });

    const timeout = options.life ?? 3500;
    const timer = setTimeout(() => {
      remove(id);
    }, timeout);
    timers.set(id, timer);

    return id;
  }

  function remove(id: string) {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return {
    toasts,
    add,
    remove,
  };
}
