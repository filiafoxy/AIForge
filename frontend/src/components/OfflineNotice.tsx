import { useOnlineStatus } from '../utils/useOnlineStatus';
import styles from './OfflineNotice.module.css';

/**
 * Предупреждение о том, что устройство не подключено к сети. Ничего не рисует, пока сеть есть.
 *
 * Остаётся у верхнего края экрана при прокрутке: страница длинная, и механик должен видеть
 * причину сбоев там, где он сейчас работает. Поэтому полоса короткая — на телефоне она не должна
 * закрывать рабочую область. Кнопки при этом не блокируются: сервисы, запущенные на этом же
 * компьютере, отвечают и без сети.
 */
export function OfflineNotice() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <p className={styles.bar} role="alert">
      <strong>Нет подключения к сети.</strong> Запросы к сервисам могут не пройти.
    </p>
  );
}
