// Лента диалога: какие в ней бывают сообщения и как она меняется.
// Только данные и правила, без запросов и разметки.

import type { AgentTicketDraft } from '../../types/agent';
import type { DiagnoseResponse } from '../../types/diagnosis';
import type { AgentAnswer } from './agentAnswer';
import type { MessageImage } from './imageAttachments';

type MessageContent =
  /** Сообщение механика. */
  | { kind: 'user'; text: string; images: readonly MessageImage[] }
  /**
   * Ответ помощника: `text` — в разметке Markdown, `thinking` — рассуждения модели, если она их прислала.
   * `analysisOf` — результат диагностики, по которому это заключение; `null` у ответа на вопрос механика.
   * `draft` — черновик заявки, если помощник его приложил.
   */
  | {
      kind: 'assistant';
      text: string;
      thinking: string | null;
      analysisOf: DiagnoseResponse | null;
      draft: AgentTicketDraft | null;
    }
  /**
   * Заявка на дефектовку по результату `diagnosis`. `open` — механик её оформляет;
   * остальное — оформление закончено. Поля заявки лента не хранит: они живут в карточке.
   * `suggestion` — черновик помощника, которым заполнена форма.
   */
  | {
      kind: 'ticket';
      diagnosis: DiagnoseResponse;
      suggestion: AgentTicketDraft | null;
      status: 'open' | 'created' | 'cancelled';
    }
  /**
   * Запрос не выполнен: что случилось и что делать. `analysisOf` — результат диагностики,
   * заключение по которому не получено: по нему запрос можно повторить.
   */
  | { kind: 'error'; title: string; text: string; analysisOf: DiagnoseResponse | null };

export type ChatMessage = MessageContent & {
  /** Порядковый номер в ленте. Сообщения только добавляются, поэтому номер не меняется. */
  id: number;
};

export interface ConversationState {
  messages: readonly ChatMessage[];
  /** Приложение ждёт результат от сервиса диагностики. */
  isDiagnosisPending: boolean;
  /** Помощник отвечает на вопрос механика. */
  isAgentPending: boolean;
  /** Помощник готовит заключение по результату диагностики. */
  isAnalysisPending: boolean;
}

export type ConversationAction =
  | { type: 'diagnosis_requested' }
  | { type: 'diagnosis_received' }
  | { type: 'diagnosis_failed'; text: string }
  | { type: 'analysis_requested' }
  | { type: 'analysis_received'; diagnosis: DiagnoseResponse; answer: AgentAnswer }
  | { type: 'analysis_failed'; diagnosis: DiagnoseResponse; text: string }
  | { type: 'question_sent'; text: string; images: readonly MessageImage[] }
  | { type: 'answer_received'; answer: AgentAnswer }
  | { type: 'answer_failed'; text: string }
  | { type: 'ticket_started'; diagnosis: DiagnoseResponse }
  | { type: 'ticket_closed'; messageId: number; status: 'created' | 'cancelled' };

export const EMPTY_CONVERSATION: ConversationState = {
  messages: [],
  isDiagnosisPending: false,
  isAgentPending: false,
  isAnalysisPending: false,
};

function withMessage(state: ConversationState, content: MessageContent): readonly ChatMessage[] {
  return [...state.messages, { ...content, id: state.messages.length }];
}

export function conversationReducer(state: ConversationState, action: ConversationAction): ConversationState {
  switch (action.type) {
    case 'diagnosis_requested':
      return { ...state, isDiagnosisPending: true };
    case 'diagnosis_received':
      // Сам результат в ленту не попадает: механику его пересказывает помощник в заключении.
      // Приложению он нужен для заявки и хранится в сообщении с заключением.
      return { ...state, isDiagnosisPending: false };
    case 'diagnosis_failed':
      return {
        ...state,
        isDiagnosisPending: false,
        messages: withMessage(state, {
          kind: 'error',
          title: 'Результат диагностики не получен',
          text: action.text,
          analysisOf: null,
        }),
      };
    case 'analysis_requested':
      return { ...state, isAnalysisPending: true };
    case 'analysis_received':
      return {
        ...state,
        isAnalysisPending: false,
        messages: withMessage(state, { kind: 'assistant', ...action.answer, analysisOf: action.diagnosis }),
      };
    case 'analysis_failed':
      return {
        ...state,
        isAnalysisPending: false,
        messages: withMessage(state, {
          kind: 'error',
          title: 'Заключение помощника не получено',
          text: action.text,
          analysisOf: action.diagnosis,
        }),
      };
    case 'question_sent':
      return {
        ...state,
        isAgentPending: true,
        messages: withMessage(state, { kind: 'user', text: action.text, images: action.images }),
      };
    case 'answer_received':
      return {
        ...state,
        isAgentPending: false,
        messages: withMessage(state, { kind: 'assistant', ...action.answer, analysisOf: null }),
      };
    case 'answer_failed':
      return {
        ...state,
        isAgentPending: false,
        messages: withMessage(state, { kind: 'error', title: 'Ответ не получен', text: action.text, analysisOf: null }),
      };
    case 'ticket_started':
      // Одновременно оформляется одна заявка: две открытые формы легко перепутать.
      if (hasOpenTicket(state.messages)) return state;
      return {
        ...state,
        messages: withMessage(state, {
          kind: 'ticket',
          diagnosis: action.diagnosis,
          suggestion: findLatestDraft(state.messages),
          status: 'open',
        }),
      };
    case 'ticket_closed':
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.id === action.messageId && message.kind === 'ticket'
            ? { ...message, status: action.status }
            : message,
        ),
      };
  }
}

export type TicketMessage = Extract<ChatMessage, { kind: 'ticket' }>;

/** Заявка, которую механик ещё оформляет. Такая в диалоге не больше одной. */
export function findOpenTicket(messages: readonly ChatMessage[]): TicketMessage | null {
  for (const message of messages) {
    if (message.kind === 'ticket' && message.status === 'open') return message;
  }
  return null;
}

/** Есть ли в диалоге заявка, которую механик ещё оформляет. */
export function hasOpenTicket(messages: readonly ChatMessage[]): boolean {
  return findOpenTicket(messages) !== null;
}

/**
 * Черновик заявки от помощника. Диалог относится к одной проверке, поэтому каждое поле берётся
 * из самого позднего ответа, где оно есть: механик мог попросить помощника что-то поправить.
 * Поля по отдельности, потому что помощник присылает их не всегда вместе — например, приоритет
 * в одном ответе, а источники в другом.
 */
export function findLatestDraft(messages: readonly ChatMessage[]): AgentTicketDraft | null {
  const drafts: AgentTicketDraft[] = [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.kind === 'assistant' && message.draft !== null) drafts.push(message.draft);
  }
  // Список идёт от позднего ответа к раннему: поздний закрывает пробелы в нём прежним.
  return drafts.reduce<AgentTicketDraft | null>(
    (later, earlier) =>
      later === null
        ? earlier
        : {
            conclusion: later.conclusion ?? earlier.conclusion,
            urgency: later.urgency ?? earlier.urgency,
            // Обоснование относится к приоритету: берётся из того же ответа, что и он.
            urgencyReason: later.urgency !== null ? later.urgencyReason : earlier.urgencyReason,
            operations: later.operations.length > 0 ? later.operations : earlier.operations,
            spareParts: later.spareParts.length > 0 ? later.spareParts : earlier.spareParts,
            references: later.references.length > 0 ? later.references : earlier.references,
          },
    null,
  );
}

/**
 * Сообщение, под которым стоит кнопка заявки: последнее заключение помощника. Кнопка в диалоге одна.
 * Без заключения заявка не предлагается: механик ещё не знает, что показала проверка.
 * `null` — заключения в ленте нет. Можно ли оформить заявку по результату, решает вызывающий.
 */
export function findTicketAnchor(messages: readonly ChatMessage[]): { id: number; diagnosis: DiagnoseResponse } | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.kind === 'assistant' && message.analysisOf !== null) {
      return { id: message.id, diagnosis: message.analysisOf };
    }
  }
  return null;
}
