// Разбор ответа агента: текст для ленты и, если агент его приложил, черновик заявки.
// Ответ агента — внешние данные: всё, что из него берётся, проверяется по виду и размеру.

import { isRecord } from '../../api/http';
import type { AgentReference, AgentTicketDraft } from '../../types/agent';

export interface AgentAnswer {
  /** Текст для ленты, без блока с черновиком. */
  text: string;
  draft: AgentTicketDraft | null;
}

const MAX_ITEMS = 30;
const MAX_ITEM_LENGTH = 500;
const MAX_CONCLUSION_LENGTH = 2000;
const DRAFT_FIELDS = ['conclusion', 'operations', 'spare_parts', 'references'];

/** Блок кода с объектом JSON: ```json { … } ```. Метка языка необязательна. */
const JSON_BLOCK_PATTERN = /```[a-z]*\s*(\{[\s\S]*?\})\s*```/gi;

const ONLY_DRAFT_TEXT = 'Помощник подготовил черновик заявки. Откройте заявку, чтобы проверить его.';

function toText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().slice(0, maxLength);
  return text === '' ? null : text;
}

/** Список строк. Агент может прислать и одну строку с переносами — её делим по строкам. */
function toTextList(value: unknown): string[] {
  const items: unknown[] = typeof value === 'string' ? value.split('\n') : Array.isArray(value) ? value : [];
  return items
    .map((item) => toText(item, MAX_ITEM_LENGTH))
    .filter((item) => item !== null)
    .slice(0, MAX_ITEMS);
}

function toPage(value: unknown): number | null {
  const page = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value;
  return typeof page === 'number' && Number.isInteger(page) && page >= 1 ? page : null;
}

function toReferences(value: unknown): AgentReference[] {
  if (!Array.isArray(value)) return [];
  const references: AgentReference[] = [];
  for (const item of value.slice(0, MAX_ITEMS)) {
    if (!isRecord(item)) continue;
    const manual = toText(item.manual, MAX_ITEM_LENGTH);
    const page = toPage(item.pdf_page ?? item.page);
    if (manual !== null && page !== null) references.push({ manual, page });
  }
  return references;
}

/** Черновик из разобранного JSON; `null`, если это не черновик или в нём нет ничего пригодного. */
function toDraft(value: unknown): AgentTicketDraft | null {
  if (!isRecord(value) || !DRAFT_FIELDS.some((field) => field in value)) return null;

  const draft: AgentTicketDraft = {
    conclusion: toText(value.conclusion, MAX_CONCLUSION_LENGTH),
    operations: toTextList(value.operations),
    spareParts: toTextList(value.spare_parts),
    references: toReferences(value.references),
  };
  const isEmpty =
    draft.conclusion === null &&
    draft.operations.length === 0 &&
    draft.spareParts.length === 0 &&
    draft.references.length === 0;
  return isEmpty ? null : draft;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Объект JSON в хвосте текста без оформления блоком кода: агент мог забыть про ```.
 * Возвращает место, где он начинается, и разобранное значение.
 */
function findTrailingJson(text: string): { start: number; value: unknown } | null {
  const trimmed = text.trimEnd();
  if (!trimmed.endsWith('}')) return null;

  for (let start = trimmed.indexOf('{'); start !== -1; start = trimmed.indexOf('{', start + 1)) {
    const value = parseJson(trimmed.slice(start));
    if (value !== undefined) return { start, value };
  }
  return null;
}

/**
 * Отделяет черновик заявки от текста ответа.
 *
 * Блоки JSON из текста убираются всегда, даже если разобрать их не удалось:
 * сырой JSON механику показывать нельзя. Черновиком считается последний пригодный блок.
 *
 * @returns `null`, если после разбора показывать нечего: ни текста, ни черновика.
 */
export function parseAgentAnswer(answer: string): AgentAnswer | null {
  const drafts: AgentTicketDraft[] = [];

  let text = answer.replace(JSON_BLOCK_PATTERN, (_block, json: string) => {
    const draft = toDraft(parseJson(json));
    if (draft !== null) drafts.push(draft);
    return '';
  });

  const trailing = findTrailingJson(text);
  if (trailing !== null) {
    const draft = toDraft(trailing.value);
    // Хвост убираем, только если это действительно черновик: иной JSON мог быть частью ответа.
    if (draft !== null) {
      drafts.push(draft);
      text = text.slice(0, trailing.start);
    }
  }

  const draft = drafts.at(-1) ?? null;
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  // Подпись к убранному блоку («Черновик заявки:») без самого блока ничего не значит.
  if (draft !== null) text = text.replace(/\n[^\n]{0,60}:$/, '').trim();
  if (text === '') {
    if (draft === null) return null;
    text = draft.conclusion ?? ONLY_DRAFT_TEXT;
  }
  return { text, draft };
}
