import type { ComponentProps } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends Omit<ComponentProps<'button'>, 'className'> {
  /** `primary` — главное действие экрана, `secondary` — всё остальное. */
  variant?: 'primary' | 'secondary';
  /** Действие выполняется: кнопка показывает индикатор и не принимает повторных нажатий. */
  isBusy?: boolean;
  /**
   * Квадратная кнопка только со значком (микрофон, скрепка). Размер области нажатия
   * тот же, что у обычной кнопки; подпись передавайте через `aria-label`.
   */
  iconOnly?: boolean;
}

export function Button({
  variant = 'secondary',
  isBusy = false,
  iconOnly = false,
  type = 'button',
  disabled,
  children,
  ...buttonProps
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${styles.button} ${styles[variant]}${iconOnly ? ` ${styles.iconOnly}` : ''}`}
      disabled={disabled || isBusy}
      aria-busy={isBusy || undefined}
      {...buttonProps}
    >
      {isBusy && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </button>
  );
}
