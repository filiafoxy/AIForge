import type { TicketUrgency } from '../../types/ticket';
import { URGENCY_TEXT } from './priority';
import type { PriorityAssessment } from './priority';
import styles from './TicketCard.module.css';

interface PriorityReasonsProps {
  /** Приоритет, выбранный в заявке. */
  urgency: TicketUrgency;
  /** Расчёт приложения: предложенный приоритет и его основания. */
  assessment: PriorityAssessment;
}

/**
 * Обоснование приоритета (FR-08): как приложение его посчитало.
 * Если механик выбрал другой приоритет, это сказано прямо — расчёт тогда остаётся для справки.
 */
export function PriorityReasons({ urgency, assessment }: PriorityReasonsProps) {
  const isChangedByMechanic = urgency !== assessment.urgency;

  return (
    <div className={styles.reasons}>
      <p>
        {isChangedByMechanic
          ? `Приоритет выбран механиком. Расчёт приложения предлагал ${URGENCY_TEXT[assessment.urgency]}:`
          : `Расчёт приложения — ${URGENCY_TEXT[assessment.urgency]}:`}
      </p>
      <ul className={styles.list}>
        {assessment.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </div>
  );
}
