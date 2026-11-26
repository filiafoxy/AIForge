import { useEffect, useReducer, useRef } from 'react';
import { ApiError } from '../../api/http';
import { fetchDiagnosis } from '../../api/mlClient';
import type { DiagnoseRequest } from '../../types/diagnosis';
import type { Session, Vehicle } from '../../types/fleet';
import { describeDiagnosisError } from '../diagnosis/diagnosisErrorMessage';
import { askAgent } from './agent';
import { conversationReducer, EMPTY_CONVERSATION, getLatestDiagnosis } from './conversationState';
import type { ChatMessage } from './conversationState';

interface UseConversationResult {
  messages: readonly ChatMessage[];
  isDiagnosisPending: boolean;
  isAgentPending: boolean;
  /** Запрашивает результат диагностики; он появится в ленте вердиктом. Без выбора ничего не делает. */
  requestDiagnosis: () => void;
  /** Отправляет вопрос помощнику. Пока ждём ответ на предыдущий, новый не принимается. */
  sendQuestion: (text: string) => void;
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

    const controller = new AbortController();
    agentRequestRef.current = controller;
    dispatch({ type: 'question_sent', text: question });

    askAgent(
      { text: question, vehicle, session, diagnosis: getLatestDiagnosis(state.messages) },
      controller.signal,
    ).then(
      (answer) => {
        if (!controller.signal.aborted) dispatch({ type: 'answer_received', text: answer.text });
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        console.error('Помощник не ответил:', cause);
        dispatch({ type: 'answer_failed', text: 'Помощник не ответил. Отправьте сообщение ещё раз.' });
      },
    );
  }

  return {
    messages: state.messages,
    isDiagnosisPending: state.isDiagnosisPending,
    isAgentPending: state.isAgentPending,
    requestDiagnosis,
    sendQuestion,
  };
}
