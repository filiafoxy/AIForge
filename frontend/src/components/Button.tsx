import type { ComponentProps } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends Omit<ComponentProps<'button'>, 'className'> {
  /** `primary` — главное действие экрана, `secondary` — всё остальное. */
  variant?: 'primary' | 'secondary';
  /** Действие выполняется: кнопка показывает индикатор и не принимает повторных нажатий. */
  isBusy?: boolean;
}

export function Button({
  variant = 'secondary',
  isBusy = false,
  type = 'button',
  disabled,
  children,
  ...buttonProps
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${styles.button} ${styles[variant]}`}
      disabled={disabled || isBusy}
      aria-busy={isBusy || undefined}
      {...buttonProps}
    >
      {isBusy && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </button>
  );
}
