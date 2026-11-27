// Приоритет заявки (FR-08): расчёт по эвристике команды и его обоснование для механика.
// Только данные и правила, без разметки.

import { HIGH_RISK_FAULT_CODES, PRIORITY_CONFIDENCE_THRESHOLD } from '../../config/heuristics';
import type { DiagnoseResponse } from '../../types/diagnosis';
import type { TicketUrgency } from '../../types/ticket';
import { formatPercent, formatScore } from '../../utils/formatNumber';
import { getDeviationLevel } from '../diagnosis/assessment';
import { DEVIATION_LEVEL_TEXT, formatConfidence, getSuspectedFault } from '../diagnosis/verdict';

export interface PriorityAssessment {
  urgency: TicketUrgency;
  /** Обоснование по шагам: из чего сложился приоритет и что в нём не учтено. */
  reasons: string[];
}

/** Ступени приоритета по возрастанию. */
const URGENCY_LEVELS: readonly TicketUrgency[] = ['low', 'medium', 'high'];

export const URGENCY_TEXT: Record<TicketUrgency, string> = {
  low: 'низкий',
  medium: 'средний',
  high: 'высокий',
};

/**
 * Считает приоритет заявки по результату диагностики.
 *
 * Исходную ступень задаёт сила отклонения. Группа неисправностей повышенного риска поднимает
 * приоритет на ступень, невысокая уверенность модели — опускает. Критичность узла по руководству
 * расчёт не знает и прямо говорит об этом: её учитывает механик.
 */
export function assessPriority(result: DiagnoseResponse): PriorityAssessment {
  const reasons: string[] = [];
  let level: number;

  if (result.anomaly_score !== null) {
    const deviation = getDeviationLevel(result.anomaly_score);
    level = URGENCY_LEVELS.indexOf(deviation);
    reasons.push(
      `Отклонение ${DEVIATION_LEVEL_TEXT[deviation]} (${formatScore(result.anomaly_score)} из 1) — ` +
        `исходный приоритет ${URGENCY_TEXT[deviation]}.`,
    );
  } else {
    level = URGENCY_LEVELS.indexOf('medium');
    reasons.push('Сервис не сообщил оценку отклонения — исходный приоритет средний.');
  }

  if (result.anomaly_type !== null && HIGH_RISK_FAULT_CODES.includes(result.anomaly_type)) {
    level += 1;
    const fault = getSuspectedFault(result);
    reasons.push(
      (fault !== null ? `Группа неисправностей «${fault}»` : 'Эта группа неисправностей') +
        ' входит в список повышенного риска: с ней опасно продолжать работу. Приоритет на ступень выше.',
    );
  }

  if (result.confidence !== null && result.confidence < PRIORITY_CONFIDENCE_THRESHOLD) {
    level -= 1;
    reasons.push(
      `Уверенность модели ${formatConfidence(result.confidence)} — ниже ` +
        `${formatPercent(PRIORITY_CONFIDENCE_THRESHOLD)}. Приоритет на ступень ниже.`,
    );
  }

  // Поправки складываются, и только итог приводится к шкале: так он не зависит от порядка поправок.
  const highest = URGENCY_LEVELS.length - 1;
  if (level > highest) {
    level = highest;
    reasons.push('Выше высокого приоритета нет.');
  } else if (level < 0) {
    level = 0;
    reasons.push('Ниже низкого приоритета нет.');
  }

  reasons.push(
    'Критичность узла по руководству в расчёте не учтена. Уточните её у помощника и при необходимости измените приоритет.',
  );

  return { urgency: URGENCY_LEVELS[level], reasons };
}
