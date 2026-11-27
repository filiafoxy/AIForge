import { useEffect, useReducer, useRef, useState } from 'react';
import { sendAgentMessage } from '../../api/agentClient';
import { ApiError } from '../../api/http';
import { fetchDiagnosis } from '../../api/mlClient';
import type { AgentRequest } from '../../types/agent';
import type { DiagnoseRequest, DiagnoseResponse } from '../../types/diagnosis';
import type { Session, Vehicle } from '../../types/fleet';
import { createRandomId } from '../../utils/createRandomId';
import { describeDiagnosisError } from '../diagnosis/diagnosisErrorMessage';
import { describeAgentError } from './agentErrorMessage';
import { conversationReducer, EMPTY_CONVERSATION } from './conversationState';
import type { ChatMessage } from './conversationState';

interface UseConversationResult {
  messages: readonly ChatMessage[];
  isDiagnosisPending: boolean;
  isAgentPending: boolean;
  /** Запрашивает результат диагностики; он появится в ленте вердиктом. Без выбора ничего не делает. */
  requestDiagnosis: () => void;
  /** Отправляет вопрос помощнику. Пока ждём ответ на предыдущий, новый не принимается. */
  sendQuestion: (text: string) => void;
  /** Открывает в ленте заявку на дефектовку по результату диагностики. */
  startTicket: (diagnosis: DiagnoseResponse) => void;
  /** Отмечает, что оформление заявки закончено: она создана или отменена. */
  closeTicket: (messageId: number, status: 'created' | 'cancelled') => void;
}

/**
 * Диалог по одной проверке: лента сообщений и два действия, которые её пополняют.
 *
 * Хук не следит за сменой машины или проверки. Компонент, который его вызывает,
 * создаётся заново для каждой пары (через `key`), поэтому диалог всегда относится
 * к одной проверке, а незавершённые запросы отменяются при уходе с неё.
 */
export function useConversation(vehicle: Vehicle | null, session: Session | null): UseConversationResult {
  const [state, dispatch] = useReducer(conversationReducer, EMPTY_CONVERSATION);
  // Идентификатор диалога для агента. Новый диалог на экране — новый идентификатор:
  // агент не должен помнить разговор о другой машине, когда механик уже выбрал эту.
  const [conversationId] = useState(createRandomId);
  const diagnosisRequestRef = useRef<AbortController | null>(null);
  const agentRequestRef = useRef<AbortController | null>(null);

  // Уходя с проверки или со страницы, не оставляем запросы висеть.
  useEffect(
    () => () => {
      diagnosisRequestRef.current?.abort();
      agentRequestRef.current?.abort();
    },
    [],
  );

  function requestDiagnosis() {
    if (vehicle === null || session === null || state.isDiagnosisPending) return;

    const request: DiagnoseRequest = { vehicle_id: vehicle.vehicle_id, session_id: session.session_id };
    const controller = new AbortController();
    diagnosisRequestRef.current = controller;
    dispatch({ type: 'diagnosis_requested' });

    fetchDiagnosis(request, controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) dispatch({ type: 'diagnosis_received', result });
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        const error = cause instanceof ApiError ? cause : new ApiError('unknown', { cause });
        // Подробности — в консоль разработчику; механик видит понятный текст в ленте.
        console.error('Запрос диагностики не выполнен:', error, error.serviceDetail ?? '');
        dispatch({ type: 'diagnosis_failed', text: describeDiagnosisError(error, request) });
      },
    );
  }

  function sendQuestion(text: string) {
    const question = text.trim();
    if (vehicle === null || session === null || question === '' || state.isAgentPending) return;

    const request: AgentRequest = {
      message: question,
      vehicle_id: vehicle.vehicle_id,
      engine_model: vehicle.engine_model,
      session_id: session.session_id,
      client_id: conversationId,
    };
    const controller = new AbortController();
    agentRequestRef.current = controller;
    dispatch({ type: 'question_sent', text: question });

    sendAgentMessage(request, controller.signal).then(
      (answer) => {
        if (!controller.signal.aborted) dispatch({ type: 'answer_received', text: answer });
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        const error = cause instanceof ApiError ? cause : new ApiError('unknown', { cause });
        console.error('Помощник не ответил:', error, error.serviceDetail ?? '');
        dispatch({ type: 'answer_failed', text: describeAgentError(error) });
      },
    );
  }

  return {
    messages: state.messages,
    isDiagnosisPending: state.isDiagnosisPending,
    isAgentPending: state.isAgentPending,
    requestDiagnosis,
    sendQuestion,
    startTicket: (diagnosis) => dispatch({ type: 'ticket_started', diagnosis }),
    closeTicket: (messageId, status) => dispatch({ type: 'ticket_closed', messageId, status }),
  };
}
