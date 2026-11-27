// Лента диалога: какие в ней бывают сообщения и как она меняется.
// Только данные и правила, без запросов и разметки.

import type { DiagnoseResponse } from '../../types/diagnosis';

type MessageContent =
  /** Сообщение механика. */
  | { kind: 'user'; text: string }
  /** Текстовый ответ помощника. */
  | { kind: 'assistant'; text: string }
  /** Результат диагностики: в ленте показывается вердиктом. */
  | { kind: 'verdict'; result: DiagnoseResponse }
  /**
   * Заявка на дефектовку по результату `diagnosis`. `open` — механик её оформляет;
   * остальное — оформление закончено. Поля заявки лента не хранит: они живут в карточке.
   */
  | { kind: 'ticket'; diagnosis: DiagnoseResponse; status: 'open' | 'created' | 'cancelled' }
  /** Запрос не выполнен: что случилось и что делать. */
  | { kind: 'error'; title: string; text: string };

export type ChatMessage = MessageContent & {
  /** Порядковый номер в ленте. Сообщения только добавляются, поэтому номер не меняется. */
  id: number;
};

export interface ConversationState {
  messages: readonly ChatMessage[];
  isDiagnosisPending: boolean;
  isAgentPending: boolean;
}

export type ConversationAction =
  | { type: 'diagnosis_requested' }
  | { type: 'diagnosis_received'; result: DiagnoseResponse }
  | { type: 'diagnosis_failed'; text: string }
  | { type: 'question_sent'; text: string }
  | { type: 'answer_received'; text: string }
  | { type: 'answer_failed'; text: string }
  | { type: 'ticket_started'; diagnosis: DiagnoseResponse }
  | { type: 'ticket_closed'; messageId: number; status: 'created' | 'cancelled' };

export const EMPTY_CONVERSATION: ConversationState = {
  messages: [],
  isDiagnosisPending: false,
  isAgentPending: false,
};

function withMessage(state: ConversationState, content: MessageContent): readonly ChatMessage[] {
  return [...state.messages, { ...content, id: state.messages.length }];
}

export function conversationReducer(state: ConversationState, action: ConversationAction): ConversationState {
  switch (action.type) {
    case 'diagnosis_requested':
      return { ...state, isDiagnosisPending: true };
    case 'diagnosis_received':
      return {
        ...state,
        isDiagnosisPending: false,
        messages: withMessage(state, { kind: 'verdict', result: action.result }),
      };
    case 'diagnosis_failed':
      return {
        ...state,
        isDiagnosisPending: false,
        messages: withMessage(state, {
          kind: 'error',
          title: 'Результат диагностики не получен',
          text: action.text,
        }),
      };
    case 'question_sent':
      return {
        ...state,
        isAgentPending: true,
        messages: withMessage(state, { kind: 'user', text: action.text }),
      };
    case 'answer_received':
      return {
        ...state,
        isAgentPending: false,
        messages: withMessage(state, { kind: 'assistant', text: action.text }),
      };
    case 'answer_failed':
      return {
        ...state,
        isAgentPending: false,
        messages: withMessage(state, { kind: 'error', title: 'Ответ не получен', text: action.text }),
      };
    case 'ticket_started':
      // Одновременно оформляется одна заявка: две открытые формы легко перепутать.
      if (hasOpenTicket(state.messages)) return state;
      return {
        ...state,
        messages: withMessage(state, { kind: 'ticket', diagnosis: action.diagnosis, status: 'open' }),
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

/** Есть ли в диалоге заявка, которую механик ещё оформляет. */
export function hasOpenTicket(messages: readonly ChatMessage[]): boolean {
  return messages.some((message) => message.kind === 'ticket' && message.status === 'open');
}
