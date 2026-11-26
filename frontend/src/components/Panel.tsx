import { useId } from 'react';
import type { ReactNode, Ref } from 'react';
import styles from './Panel.module.css';

interface PanelProps {
  title: string;
  /** Элемент справа от заголовка, обычно кнопка действия. */
  action?: ReactNode;
  /** Если передан, на заголовок можно перевести фокус из кода — когда содержимое блока сменилось. */
  headingRef?: Ref<HTMLHeadingElement>;
  children: ReactNode;
}

/** Блок страницы с заголовком: белая карточка, размеченная как именованный раздел. */
export function Panel({ title, action, headingRef, children }: PanelProps) {
  const headingId = useId();

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <div className={styles.header}>
        <h2 id={headingId} ref={headingRef} tabIndex={headingRef ? -1 : undefined} className={styles.title}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
