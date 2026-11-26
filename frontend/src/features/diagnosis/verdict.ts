// Вердикт для механика: превращает ответ ML-сервиса в заголовок, пояснение и разделы.
// Только текст и данные, без разметки. Порядок разделов задан требованиями FR-02 — FR-04.

import {
  DEVIATION_HIGH_FROM_SCORE,
  DEVIATION_MEDIUM_FROM_SCORE,
  LOW_CONFIDENCE_THRESHOLD,
} from '../../config/heuristics';
import { faultTypes } from '../../data/fleet';
import type { DiagnoseResponse, SignalQuality } from '../../types/diagnosis';
import type { Vehicle } from '../../types/fleet';
import { formatPercent, formatScore } from '../../utils/formatNumber';
import { assessReliability, getDeviationLevel, isAnalysisFailed } from './assessment';
import type { DeviationLevel } from './assessment';

/**
 * Вид вердикта:
 * - `normal` — отклонений нет;
 * - `anomaly` — отклонение найдено, результату можно доверять;
 * - `unreliable` — результат есть, но уверенность модели низкая: доверять ему нельзя (FR-04);
 * - `failed` — анализ не состоялся: сбой записи или непригодная запись, диагноза нет (FR-03, FR-04).
 */
export type VerdictKind = 'normal' | 'anomaly' | 'unreliable' | 'failed';

export interface VerdictSection {
  heading: string;
  paragraphs: string[];
  /**
   * Текст, который сервис прислал как есть. Показывается цитатой с подписью источника.
   * Это внешние данные: на вид вердикта они не влияют.
   */
  serviceText?: string;
}

export interface VerdictFact {
  label: string;
  value: string;
}

export interface Verdict {
  kind: VerdictKind;
  /** Короткая метка над заголовком. */
  label: string;
  title: string;
  summary: string[];
  /** Предупреждение о записи с помехами: вывод остаётся в силе, но достоверность может быть ниже. */
  caution: string | null;
  sections: VerdictSection[];
  /** Показатели сервиса. При несостоявшемся анализе — только качество записи. */
  facts: VerdictFact[];
  /** Пороги команды и правило чтения показателей: FR-04 требует показывать их в интерфейсе. */
  factsNotes: string[];
}

const SIGNAL_QUALITY_TEXT: Record<SignalQuality, string> = {
  good: 'хорошее',
  warning: 'с помехами',
  bad: 'непригодное для анализа',
};

const DEVIATION_LEVEL_TEXT: Record<DeviationLevel, string> = {
  low: 'слабое',
  medium: 'умеренное',
  high: 'сильное',
};

const REPEAT_CHECK_TEXT = 'Запишите звук двигателя заново и запросите результат по новой проверке.';
const SOUND_ONLY_TEXT =
  'Результат основан только на звуке двигателя: пробег, показания приборов и коды ошибок не учитываются.';
const NOISY_RECORDING_CAUTION =
  'Запись сделана с помехами, поэтому достоверность результата может быть ниже. При сомнениях повторите проверку.';

const CONFIDENCE_THRESHOLD_TEXT = formatPercent(LOW_CONFIDENCE_THRESHOLD);

/** Правило команды для случая, когда оценка отклонения и уверенность расходятся (FR-04). */
const CONFIDENCE_RULE_TEXT =
  `Порог уверенности модели — ${CONFIDENCE_THRESHOLD_TEXT}. ` +
  'Если уверенность ниже, результат считается недостоверным при любой оценке отклонения, даже высокой.';

const DEVIATION_SCALE_TEXT =
  `Оценка отклонения: до ${formatScore(DEVIATION_MEDIUM_FROM_SCORE)} — слабое, ` +
  `от ${formatScore(DEVIATION_MEDIUM_FROM_SCORE)} — умеренное, ` +
  `от ${formatScore(DEVIATION_HIGH_FROM_SCORE)} — сильное.`;

/** Строит вердикт по ответу сервиса. Вид вердикта зависит только от полей статуса, качества и уверенности. */
export function buildVerdict(result: DiagnoseResponse, vehicle: Vehicle): Verdict {
  if (isAnalysisFailed(result)) {
    return buildFailedVerdict(result);
  }

  const reliability = assessReliability(result);
  if (reliability === 'unreliable') {
    return buildUnreliableVerdict(result);
  }

  const caution = reliability === 'reduced' ? NOISY_RECORDING_CAUTION : null;
  return result.status === 'anomaly'
    ? buildAnomalyVerdict(result, vehicle, caution)
    : buildNormalVerdict(result, caution);
}

function buildFailedVerdict(result: DiagnoseResponse): Verdict {
  // При `check_failed` описание сервиса — это причина сбоя. При непригодной записи со статусом
  // `normal` или `anomaly` в описании стоят признаки неисправности: их не показываем,
  // иначе вышел бы диагноз, которого по такой записи быть не должно.
  const reason: VerdictSection =
    result.status === 'check_failed'
      ? { heading: 'Причина', paragraphs: [], serviceText: result.description }
      : { heading: 'Причина', paragraphs: ['Сервис оценил запись как непригодную для анализа.'] };

  return {
    kind: 'failed',
    label: 'Анализ не выполнен',
    title: 'Запись не удалось проанализировать',
    summary: ['Вывода о состоянии двигателя нет: по этой записи его сделать нельзя.'],
    caution: null,
    sections: [
      reason,
      {
        heading: 'Что сделать',
        paragraphs: [REPEAT_CHECK_TEXT],
      },
    ],
    facts: [{ label: 'Качество записи', value: SIGNAL_QUALITY_TEXT[result.signal_quality] }],
    factsNotes: [],
  };
}

function buildNormalVerdict(result: DiagnoseResponse, caution: string | null): Verdict {
  return {
    kind: 'normal',
    label: 'Норма',
    title: 'Значимых отклонений не обнаружено',
    summary: ['По звуку работы двигателя отклонений не выявлено. Рекомендаций по ремонту нет.'],
    caution,
    sections: [
      {
        heading: 'Наблюдения',
        paragraphs: [],
        serviceText: result.description,
      },
      ...buildSourceSections(result, [SOUND_ONLY_TEXT, 'Проверка не заменяет плановое обслуживание.']),
    ],
    facts: buildFacts(result),
    factsNotes: [CONFIDENCE_RULE_TEXT],
  };
}

function buildAnomalyVerdict(result: DiagnoseResponse, vehicle: Vehicle, caution: string | null): Verdict {
  const fault = getSuspectedFault(result);

  return {
    kind: 'anomaly',
    label: 'Обнаружено отклонение',
    title: fault !== null ? `Отклонение, предположительно: ${lowerFirst(fault)}` : 'Отклонение в звуке двигателя',
    summary: ['Это предположение по звуку, а не подтверждённая неисправность. Подтвердите его проверкой.'],
    caution,
    sections: [
      {
        heading: 'Наблюдения',
        paragraphs: [],
        serviceText: result.description,
      },
      {
        heading: 'Гипотеза',
        paragraphs: [
          fault !== null
            ? `Сервис относит звук к группе неисправностей «${fault}». Другие причины без проверки исключить нельзя.`
            : 'Сервис не указал, к какой группе неисправностей относится этот звук.',
        ],
      },
      {
        heading: 'Что проверить',
        paragraphs: [
          fault !== null
            ? `Проверьте двигатель ${vehicle.engine_model} по направлению «${fault}», пользуясь руководством по ремонту.`
            : `Проведите осмотр двигателя ${vehicle.engine_model} по руководству по ремонту.`,
        ],
      },
      {
        heading: 'Возможные действия',
        paragraphs: [
          'Если проверка подтвердит неисправность, оформите заявку на ремонт.',
          'Если не подтвердит, повторите акустическую проверку.',
        ],
      },
      ...buildSourceSections(result, [
        SOUND_ONLY_TEXT,
        'Порядка проверки и допустимых значений в этом результате нет: берите их из руководства по ремонту.',
      ]),
    ],
    facts: buildFacts(result, true),
    factsNotes: [CONFIDENCE_RULE_TEXT, DEVIATION_SCALE_TEXT],
  };
}

function buildUnreliableVerdict(result: DiagnoseResponse): Verdict {
  const fault = getSuspectedFault(result);

  let observation: string;
  if (result.status === 'anomaly') {
    observation =
      fault !== null
        ? `Сервис отметил возможное отклонение: ${lowerFirst(fault)}. При такой уверенности это не повод для ремонта.`
        : 'Сервис отметил возможное отклонение. При такой уверенности это не повод для ремонта.';
  } else {
    observation = 'Сервис не отметил отклонений. При такой уверенности это не подтверждает, что двигатель исправен.';
  }

  const summary = [
    result.confidence !== null
      ? `Уверенность модели — ${formatConfidence(result.confidence)}, это ниже порога ${CONFIDENCE_THRESHOLD_TEXT}.`
      : 'Сервис не сообщил уверенность модели.',
  ];
  if (result.signal_quality === 'warning') {
    summary.push('Запись сделана с помехами.');
  }
  summary.push('Делать выводы о состоянии двигателя по этой проверке нельзя.');

  return {
    kind: 'unreliable',
    label: 'Результат недостоверен',
    title: 'Повторите проверку',
    summary,
    caution: null,
    sections: [
      {
        heading: 'Что заметил сервис',
        paragraphs: [observation],
        serviceText: result.description,
      },
      {
        heading: 'Что сделать',
        paragraphs: [REPEAT_CHECK_TEXT],
      },
      ...buildSourceSections(result, [SOUND_ONLY_TEXT]),
    ],
    facts: buildFacts(result),
    factsNotes: [CONFIDENCE_RULE_TEXT],
  };
}

/** Два последних раздела вердикта: откуда результат и чего в нём нет. */
function buildSourceSections(result: DiagnoseResponse, limitations: string[]): VerdictSection[] {
  return [
    {
      heading: 'Источник',
      paragraphs: [`Сервис акустической диагностики, версия модели ${result.model_version}.`],
    },
    {
      heading: 'Ограничения',
      paragraphs: limitations,
    },
  ];
}

/**
 * @param withDeviationLevel Добавить к числу словесную оценку силы отклонения. Уместно, только когда
 *   отклонение признано: при норме и при недостоверном результате такая оценка читалась бы как вывод.
 */
function buildFacts(result: DiagnoseResponse, withDeviationLevel = false): VerdictFact[] {
  const facts: VerdictFact[] = [];

  if (result.anomaly_score !== null) {
    const score = `${formatScore(result.anomaly_score)} из 1`;
    facts.push({
      label: 'Отклонение от нормы',
      value: withDeviationLevel
        ? `${DEVIATION_LEVEL_TEXT[getDeviationLevel(result.anomaly_score)]}, ${score}`
        : score,
    });
  }
  if (result.confidence !== null) {
    facts.push({ label: 'Уверенность модели', value: formatConfidence(result.confidence) });
  }
  facts.push({ label: 'Качество записи', value: SIGNAL_QUALITY_TEXT[result.signal_quality] });

  return facts;
}

/**
 * Название группы неисправностей под подозрением: узел («Генератор») или признак («Низкое давление масла»).
 * Код неисправности механику не показываем — только название: коды условные, в руководствах их нет.
 */
function getSuspectedFault(result: DiagnoseResponse): string | null {
  if (result.anomaly_title !== null && result.anomaly_title.trim() !== '') {
    return result.anomaly_title.trim();
  }
  return faultTypes.find((fault) => fault.code === result.anomaly_type)?.title ?? null;
}

/**
 * Уверенность в процентах с округлением вниз: значение чуть ниже порога не должно
 * выглядеть равным порогу («55 % — ниже порога 55 %»).
 */
function formatConfidence(confidence: number): string {
  // Сначала убираем погрешность двоичной дроби (0.57 * 100 = 56.99999999999999), потом отбрасываем доли процента.
  const wholePercent = Math.floor(Math.round(confidence * 10_000) / 100);
  return formatPercent(wholePercent / 100);
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase('ru-RU') + text.slice(1);
}
