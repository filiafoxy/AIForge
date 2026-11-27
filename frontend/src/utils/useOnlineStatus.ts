import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/**
 * Сообщает, подключено ли устройство к сети, и обновляется при смене состояния.
 *
 * `false` надёжно: сети точно нет. `true` значит только, что сетевое подключение есть;
 * сами сервисы при этом могут быть недоступны.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine);
}
