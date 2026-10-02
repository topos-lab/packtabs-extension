import { ref } from 'vue';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  title?: string;
  message: string;
}

const toasts = ref<ToastItem[]>([]);

export function useToast() {
  function add(options: {
    severity?: 'success' | 'error' | 'info';
    summary?: string;
    detail?: string;
    message?: string;
    life?: number;
  }) {
    const id = crypto.randomUUID();
    const type = options.severity === 'error' ? 'error' : options.severity === 'info' ? 'info' : 'success';
    const message = options.detail || options.message || options.summary || '';
    const title = options.summary && options.summary !== message ? options.summary : undefined;

    toasts.value.push({ id, type, title, message });

    const timeout = options.life ?? 3500;
    setTimeout(() => {
      remove(id);
    }, timeout);
  }

  function remove(id: string) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return {
    toasts,
    add,
    remove,
  };
}
