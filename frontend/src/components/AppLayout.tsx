import type { ReactNode } from 'react';
import developerLogoUrl from '../assets/developer-logo.png';
import styles from './AppLayout.module.css';

interface AppLayoutProps {
  children: ReactNode;
}

/** Общая рамка приложения: шапка с названием и адаптивная область контента. */
export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <svg className={styles.logo} viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="currentColor" />
            <path
              d="M5 16h4l3-8 4 16 4-12 2 4h5"
              fill="none"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className={styles.brand}>
            <span className={styles.title}>Цифровой механик</span>
            <span className={styles.subtitle}>
              НейроДВС
              <span className={styles.subtitleDetail}> · акустическая диагностика</span>
            </span>
          </div>
          <img
            className={styles.developerLogo}
            src={developerLogoUrl}
            alt="Логотип компании-разработчика"
            width={36}
            height={36}
          />
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
