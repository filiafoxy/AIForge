// Оценка ответа ML-сервиса по эвристикам команды: состоялся ли анализ, насколько ему можно верить
// и насколько сильно отклонение.

import {
  DEVIATION_HIGH_FROM_SCORE,
  DEVIATION_MEDIUM_FROM_SCORE,
  LOW_CONFIDENCE_THRESHOLD,
} from '../../config/heuristics';
import type { DiagnoseResponse } from '../../types/diagnosis';

/**
 * Анализ не состоялся: сервис отбраковал запись (`check_failed`, FR-03) или оценил её
 * как непригодную (`signal_quality = bad`, FR-04). Во втором случае статус и оценки
 * в ответе могут быть заполнены, но диагноз по ним не ставится.
 */
export function isAnalysisFailed(result: DiagnoseResponse): boolean {
  return result.status === 'check_failed' || result.signal_quality === 'bad';
}

/**
 * Насколько можно полагаться на результат состоявшегося анализа (FR-04):
 * - `reliable` — запись хорошая, уверенность достаточная;
 * - `reduced` — запись с помехами: вывод остаётся в силе, но с предупреждением;
 * - `unreliable` — уверенность ниже порога или не указана: выводов не делаем.
 */
export type Reliability = 'reliable' | 'reduced' | 'unreliable';

/** Оценивает достоверность результата. Вызывать, только если анализ состоялся. */
export function assessReliability(result: DiagnoseResponse): Reliability {
  // Без числа уверенности подтвердить достоверность нечем — считаем её низкой.
  if (result.confidence === null || result.confidence < LOW_CONFIDENCE_THRESHOLD) {
    return 'unreliable';
  }
  return result.signal_quality === 'warning' ? 'reduced' : 'reliable';
}

/** Сила отклонения по `anomaly_score`. */
export type DeviationLevel = 'low' | 'medium' | 'high';

export function getDeviationLevel(anomalyScore: number): DeviationLevel {
  if (anomalyScore >= DEVIATION_HIGH_FROM_SCORE) return 'high';
  if (anomalyScore >= DEVIATION_MEDIUM_FROM_SCORE) return 'medium';
  return 'low';
}
