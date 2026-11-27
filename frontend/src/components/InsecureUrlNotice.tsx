import { Notice } from './Notice';
import styles from './MissingEnvNotice.module.css';

interface InsecureUrlNoticeProps {
  /** Имена переменных окружения, чьи адреса заданы по `http://` при странице, открытой по HTTPS. */
  variableNames: readonly string[];
}

/**
 * Сообщение о сервисах, запросы к которым браузер заблокирует: страница открыта по HTTPS,
 * а адрес сервиса задан по `http://`. Ничего не рисует, если таких адресов нет.
 */
export function InsecureUrlNotice({ variableNames }: InsecureUrlNoticeProps) {
  if (variableNames.length === 0) return null;

  return (
    <Notice tone="error" title="Браузер заблокирует запросы к сервисам">
      <p>
        Страница открыта по <code>https://</code>, а адреса в этих переменных заданы по <code>http://</code>.
        Укажите адреса по <code>https://</code> и соберите приложение заново.
      </p>
      <ul className={styles.list}>
        {variableNames.map((name) => (
          <li key={name}>
            <code>{name}</code>
          </li>
        ))}
      </ul>
    </Notice>
  );
}
