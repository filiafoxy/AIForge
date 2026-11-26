import type { ReactNode } from 'react';
import styles from './Notice.module.css';

interface NoticeProps {
  /** `warning` — стоит обратить внимание, `error` — действие не выполнено. */
  tone: 'warning' | 'error';
  title: string;
  children?: ReactNode;
}

/** Заметное сообщение на странице. Программы экранного доступа зачитывают его сразу при появлении. */
export function Notice({ tone, title, children }: NoticeProps) {
  return (
    <div className={`${styles.notice} ${styles[tone]}`} role="alert">
      <p className={styles.title}>{title}</p>
      {children}
    </div>
  );
}
