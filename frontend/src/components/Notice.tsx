import type { ReactNode } from 'react';
import styles from './Notice.module.css';

interface NoticeProps {
  /** `warning` — стоит обратить внимание, `error` — действие не выполнено. */
  tone: 'warning' | 'error';
  title: string;
  /**
   * Не объявлять сообщение отдельно. Нужно внутри области, за которой экранный диктор
   * уже следит сам (например, ленты диалога): иначе он прочитает сообщение дважды.
   */
  quiet?: boolean;
  children?: ReactNode;
}

/** Заметное сообщение на странице. Программы экранного доступа зачитывают его сразу при появлении. */
export function Notice({ tone, title, quiet = false, children }: NoticeProps) {
  return (
    <div className={`${styles.notice} ${styles[tone]}`} role={quiet ? undefined : 'alert'}>
      <p className={styles.title}>{title}</p>
      {children}
    </div>
  );
}
