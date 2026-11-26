import { Notice } from './Notice';
import styles from './MissingEnvNotice.module.css';

interface MissingEnvNoticeProps {
  /** Имена незаданных переменных окружения. */
  variableNames: readonly string[];
}

/** Предупреждение о незаданных адресах сервисов. Ничего не рисует, если всё задано. */
export function MissingEnvNotice({ variableNames }: MissingEnvNoticeProps) {
  if (variableNames.length === 0) return null;

  return (
    <Notice tone="warning" title="Не заданы адреса сервисов">
      <p>
        Скопируйте <code>.env.example</code> в <code>.env</code> в папке <code>frontend</code>,
        заполните переменные и перезапустите <code>npm run dev</code>.
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
