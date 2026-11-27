import type { TicketUrgency } from '../../types/ticket';
import { URGENCY_TEXT } from './priority';
import type { PriorityAssessment } from './priority';
import styles from './TicketCard.module.css';

interface PriorityReasonsProps {
  /** Приоритет, выбранный в заявке. */
  urgency: TicketUrgency;
  /** Предложенный приоритет, его автор и основания. */
  assessment: PriorityAssessment;
}

/**
 * Обоснование приоритета (FR-08): кто его предложил и почему.
 * Если механик выбрал другой приоритет, это сказано прямо — предложение тогда остаётся для справки.
 */
export function PriorityReasons({ urgency, assessment }: PriorityReasonsProps) {
  const isChangedByMechanic = urgency !== assessment.urgency;
  const proposed = URGENCY_TEXT[assessment.urgency];
  const author = assessment.source === 'agent' ? 'Помощник' : 'Расчёт приложения (помощник приоритет не назвал)';

  return (
    <div className={styles.reasons}>
      <p>
        {isChangedByMechanic
          ? `Приоритет выбран механиком. ${author} предлагал ${proposed}:`
          : `${author} — ${proposed}:`}
      </p>
      <ul className={styles.list}>
        {assessment.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </div>
  );
}
