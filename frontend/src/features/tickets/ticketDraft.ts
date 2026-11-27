// Черновик заявки на дефектовку: когда её можно оформить, чем заполнить и как проверить перед отправкой.
// Только данные и правила, без запросов и разметки.

import type { Manual } from '../../config/manuals';
import type { AgentTicketDraft } from '../../types/agent';
import type { DiagnoseResponse } from '../../types/diagnosis';
import type { Session, Vehicle } from '../../types/fleet';
import type { TicketReference, TicketRequest, TicketUrgency } from '../../types/ticket';
import { formatDateTime } from '../../utils/formatDateTime';
import { formatScore } from '../../utils/formatNumber';
import { assessReliability, getDeviationLevel, isAnalysisFailed } from '../diagnosis/assessment';
import { DEVIATION_LEVEL_TEXT, formatConfidence, getSuspectedFault, lowerFirst } from '../diagnosis/verdict';

/** Код неисправности, который принимает ТОиР: `F01`…`F14`. */
const FAULT_CODE_PATTERN = /^F(0[1-9]|1[0-4])$/;

export const MAX_TEXT_LENGTH = 2000;

/** Одна ссылка на источник в форме. Страница хранится текстом — так, как её ввёл механик. */
export interface ReferenceDraft {
  /** Номер строки в форме: по нему строки различаются при добавлении и удалении. */
  id: number;
  manual: string;
  page: string;
}

/** Заявка в том виде, в каком её правит механик. */
export interface TicketDraft {
  conclusion: string;
  urgency: TicketUrgency;
  /** Работы, по одной в строке. */
  operations: string;
  /** Запчасти, по одной в строке; может быть пусто. */
  spareParts: string;
  references: ReferenceDraft[];
}

/** Замечания к черновику. Ключи ссылок — `ReferenceDraft.id`. */
export interface DraftErrors {
  conclusion?: string;
  operations?: string;
  references?: string;
  referenceRows: Record<number, string>;
}

export const NO_DRAFT_ERRORS: DraftErrors = { referenceRows: {} };

export type DraftValidation = { isValid: true; request: TicketRequest } | { isValid: false; errors: DraftErrors };

/**
 * Можно ли оформить заявку по этому результату.
 *
 * Только по достоверному отклонению: при норме чинить нечего, а при сбое записи, непригодной
 * записи и низкой уверенности диагноза нет — заявка с ним ввела бы ремонтную службу в заблуждение.
 */
export function canRequestTicket(result: DiagnoseResponse): boolean {
  return (
    result.status === 'anomaly' &&
    !isAnalysisFailed(result) &&
    assessReliability(result) !== 'unreliable' &&
    result.anomaly_type !== null &&
    FAULT_CODE_PATTERN.test(result.anomaly_type)
  );
}

/**
 * Черновик по результату диагностики.
 *
 * Заполняется только тем, что приложение знает наверняка. Порядок ремонта, запчасти и страницы
 * руководства оно не знает и не подставляет: их вносит механик по ответам помощника или по руководству.
 * Описание от сервиса диагностики в заявку не переносится — это внешний текст.
 */
export function buildInitialDraft(
  diagnosis: DiagnoseResponse,
  vehicle: Vehicle,
  session: Session,
  urgency: TicketUrgency,
  manuals: readonly Manual[],
): TicketDraft {
  const fault = getSuspectedFault(diagnosis);

  const facts: string[] = [];
  if (diagnosis.anomaly_score !== null) {
    const level = DEVIATION_LEVEL_TEXT[getDeviationLevel(diagnosis.anomaly_score)];
    facts.push(`Отклонение ${level} (${formatScore(diagnosis.anomaly_score)} из 1)`);
  }
  if (diagnosis.confidence !== null) {
    facts.push(`уверенность модели ${formatConfidence(diagnosis.confidence)}`);
  }

  const conclusion = [
    `Акустическая проверка от ${formatDateTime(session.checked_at)}: отклонение` +
      (fault !== null ? `, предположительно ${lowerFirst(fault)}.` : ' в звуке двигателя.'),
    facts.length > 0 ? `${upperFirst(facts.join(', '))}.` : '',
    diagnosis.signal_quality === 'warning' ? 'Запись сделана с помехами.' : '',
    'Нужна дефектовка, чтобы подтвердить или исключить неисправность.',
  ]
    .filter((sentence) => sentence !== '')
    .join(' ');

  return {
    conclusion,
    urgency,
    operations:
      fault !== null
        ? `Дефектовка двигателя ${vehicle.engine_model} по направлению «${fault}»`
        : `Дефектовка двигателя ${vehicle.engine_model}`,
    spareParts: '',
    // Одна пустая строка источника: руководство выбрано, страницу вписывает механик.
    references: [{ id: 0, manual: manuals[0]?.name ?? '', page: '' }],
  };
}

/** Что из черновика помощника попало в форму. */
export interface AppliedSuggestion {
  draft: TicketDraft;
  /** Что именно взято из черновика помощника: «заключение», «работы», «источники»… Пусто — ничего. */
  appliedFields: string[];
  /**
   * Ссылки помощника, которые в форму не попали: документа нет среди руководств этого двигателя
   * или в нём нет такой страницы. Показываются механику текстом — решать ему.
   */
  rejectedReferences: string[];
}

/** Название документа без различий в регистре, кавычках, пробелах и расширении файла. */
function normalizeManualName(name: string): string {
  return name
    .toLocaleLowerCase('ru-RU')
    .replace(/\.pdf$/, '')
    .replace(/[«»"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ищет руководство двигателя по названию, которое дал помощник. Совпадением считается то же
 * название или название, целиком входящее в другое: помощник мог сократить его или дополнить.
 * Неполное совпадение принимается, только если подходит одно руководство: угадывать между двумя нельзя.
 */
function findManual(name: string, manuals: readonly Manual[]): Manual | undefined {
  const wanted = normalizeManualName(name);
  if (wanted === '') return undefined;

  // Все названия руководства: обозначение из ТЗ и имена файлов.
  const namesOf = (manual: Manual) => [manual.name, ...manual.aliases].map(normalizeManualName);

  const exact = manuals.find((manual) => namesOf(manual).includes(wanted));
  if (exact !== undefined) return exact;

  const partial = manuals.filter((manual) =>
    namesOf(manual).some((known) => wanted.includes(known) || known.includes(wanted)),
  );
  return partial.length === 1 ? partial[0] : undefined;
}

/**
 * Заполняет черновик тем, что предложил помощник.
 *
 * Берётся только пригодное. Ссылка попадает в форму, если документ есть среди руководств этого
 * двигателя и страница в нём существует: так в заявку не попадёт чужое руководство или
 * несуществующая страница. Приоритет берётся у помощника, если он его назвал; иначе остаётся
 * запасной расчёт приложения из `base`.
 */
export function applyAgentSuggestion(
  base: TicketDraft,
  suggestion: AgentTicketDraft | null,
  manuals: readonly Manual[],
): AppliedSuggestion {
  if (suggestion === null) return { draft: base, appliedFields: [], rejectedReferences: [] };

  const references: ReferenceDraft[] = [];
  const rejectedReferences: string[] = [];
  for (const reference of suggestion.references) {
    const manual = findManual(reference.manual, manuals);
    if (manual === undefined || reference.page > manual.pageCount) {
      rejectedReferences.push(`${reference.manual}, страница ${reference.page}`);
      continue;
    }
    const page = String(reference.page);
    if (!references.some((row) => row.manual === manual.name && row.page === page)) {
      references.push({ id: references.length, manual: manual.name, page });
    }
  }

  const conclusion = suggestion.conclusion?.slice(0, MAX_TEXT_LENGTH) ?? null;
  const operations = suggestion.operations.join('\n').slice(0, MAX_TEXT_LENGTH);
  const spareParts = suggestion.spareParts.join('\n').slice(0, MAX_TEXT_LENGTH);

  const appliedFields = [
    conclusion !== null ? 'заключение' : null,
    suggestion.urgency !== null ? 'приоритет' : null,
    operations !== '' ? 'работы' : null,
    spareParts !== '' ? 'запчасти' : null,
    references.length > 0 ? 'источники' : null,
  ].filter((field) => field !== null);

  return {
    draft: {
      ...base,
      conclusion: conclusion ?? base.conclusion,
      urgency: suggestion.urgency ?? base.urgency,
      operations: operations !== '' ? operations : base.operations,
      spareParts,
      references: references.length > 0 ? references : base.references,
    },
    appliedFields,
    rejectedReferences,
  };
}

/** Проверяет черновик по контракту ТОиР и собирает из него заявку. */
export function validateDraft(
  draft: TicketDraft,
  diagnosis: DiagnoseResponse,
  manuals: readonly Manual[],
): DraftValidation {
  const errors: DraftErrors = { referenceRows: {} };

  const conclusion = draft.conclusion.trim();
  if (conclusion === '') errors.conclusion = 'Напишите заключение: что не так с двигателем.';

  const operations = splitLines(draft.operations);
  if (operations.length === 0) errors.operations = 'Укажите хотя бы одну работу.';

  const references: TicketReference[] = [];
  if (draft.references.length === 0) {
    errors.references = 'Добавьте хотя бы один источник: руководство и номер страницы.';
  }
  for (const row of draft.references) {
    const manual = manuals.find((candidate) => candidate.name === row.manual);
    if (manual === undefined) {
      errors.referenceRows[row.id] = 'Выберите руководство.';
      continue;
    }
    const page = /^\d+$/.test(row.page.trim()) ? Number(row.page.trim()) : NaN;
    if (!(page >= 1 && page <= manual.pageCount)) {
      errors.referenceRows[row.id] = `Укажите номер страницы — целое число от 1 до ${manual.pageCount}.`;
      continue;
    }
    // Одну и ту же страницу дважды в заявку не кладём.
    if (!references.some((reference) => reference.manual === manual.name && reference.pdf_page === page)) {
      references.push({ manual: manual.name, pdf_page: page });
    }
  }

  const hasErrors =
    errors.conclusion !== undefined ||
    errors.operations !== undefined ||
    errors.references !== undefined ||
    Object.keys(errors.referenceRows).length > 0;
  // Код неисправности проверен ещё до открытия формы; здесь — чтобы тип заявки был строгим.
  if (hasErrors || diagnosis.anomaly_type === null) return { isValid: false, errors };

  return {
    isValid: true,
    request: {
      vehicle_id: diagnosis.vehicle_id,
      session_id: diagnosis.session_id,
      anomaly_type: diagnosis.anomaly_type,
      conclusion,
      urgency: draft.urgency,
      operations,
      spare_parts: splitLines(draft.spareParts),
      references,
    },
  };
}

/** Непустые строки текста без пробелов по краям. */
function splitLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

function upperFirst(text: string): string {
  return text.charAt(0).toLocaleUpperCase('ru-RU') + text.slice(1);
}
