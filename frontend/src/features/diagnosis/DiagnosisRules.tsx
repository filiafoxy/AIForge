import {
  DEVIATION_HIGH_FROM_SCORE,
  DEVIATION_MEDIUM_FROM_SCORE,
  LOW_CONFIDENCE_THRESHOLD,
} from '../../config/heuristics';
import { formatPercent, formatScore } from '../../utils/formatNumber';
import styles from './DiagnosisRules.module.css';

/**
 * Порог и правила, по которым приложение оценивает результат диагностики (FR-04).
 * Числа берутся из тех же констант, по которым работает расчёт, поэтому текст не разойдётся с ним.
 */
export function DiagnosisRules() {
  return (
    <details className={styles.rules}>
      <summary>Как оценивается результат</summary>
      <ul className={styles.list}>
        <li>
          Уверенность модели ниже {formatPercent(LOW_CONFIDENCE_THRESHOLD)} — результат недостоверен, какой бы ни была
          оценка отклонения. Если оценка высокая, а уверенность низкая, верим уверенности: проверку нужно повторить.
        </li>
        <li>Запись с помехами — результат показывается, но достоверность может быть ниже.</li>
        <li>Запись непригодна или проверка не удалась — диагноз не ставится, проверку нужно повторить.</li>
        <li>
          Сила отклонения по оценке: слабое — ниже {formatScore(DEVIATION_MEDIUM_FROM_SCORE)}, умеренное — до{' '}
          {formatScore(DEVIATION_HIGH_FROM_SCORE)}, сильное — от {formatScore(DEVIATION_HIGH_FROM_SCORE)}.
        </li>
        <li>Заявку на дефектовку можно создать только по достоверному отклонению.</li>
      </ul>
    </details>
  );
}
