import { useEffect, useReducer, useRef, useState } from 'react';
import { sendAgentMessage } from '../../api/agentClient';
import { ApiError } from '../../api/http';
import { fetchDiagnosis } from '../../api/mlClient';
import type { DiagnoseRequest, DiagnoseResponse } from '../../types/diagnosis';
import type { Session, Vehicle } from '../../types/fleet';
import { createRandomId } from '../../utils/createRandomId';
import { describeDiagnosisError } from '../diagnosis/diagnosisErrorMessage';
import { parseAgentAnswer } from './agentAnswer';
import type { AgentAnswer } from './agentAnswer';
import { describeAgentError } from './agentErrorMessage';
import { ANALYSIS_REQUEST } from './analysisRequest';
import { conversationReducer, EMPTY_CONVERSATION } from './conversationState';
import type { ChatMessage } from './conversationState';

interface UseConversationResult {
  messages: readonly ChatMessage[];
  isDiagnosisPending: boolean;
  /** Помощник отвечает на вопрос механика. */
  isAgentPending: boolean;
  /** Помощник готовит заключение по результату диагностики. */
  isAnalysisPending: boolean;
  /**
   * Запрашивает результат диагностики и следом — заключение помощника по нему. В ленте появляется
   * только заключение. Без выбора и пока помощник занят ничего не делает.
   */
  requestDiagnosis: () => void;
  /** Повторно запрашивает заключение помощника по уже полученному результату — после сбоя. */
  requestAnalysis: (diagnosis: DiagnoseResponse) => void;
  /** Отправляет вопрос помощнику. Пока ждём ответ на предыдущий, новый не принимается. */
  sendQuestion: (text: string) => void;
  /** Открывает в ленте заявку на дефектовку по результату диагностики. */
  startTicket: (diagnosis: DiagnoseResponse) => void;
  /** Отмечает, что оформление заявки закончено: она создана или отменена. */
  closeTicket: (messageId: number, status: 'created' | 'cancelled') => void;
}

function toApiError(cause: unknown): ApiError {
  return cause instanceof ApiError ? cause : new ApiError('unknown', { cause });
}

/**
 * Диалог по одной проверке: лента сообщений и действия, которые её пополняют.
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
  const questionRequestRef = useRef<AbortController | null>(null);
  // Запросы к агенту: пока один выполняется, второй не отправляется. Занятость проверяется по ссылкам,
  // а не по состоянию: заключение запрашивается из обработчика ответа диагностики, где состояние
  // уже устарело. По завершении запроса ссылка обнуляется.
  const analysisRequestRef = useRef<AbortController | null>(null);

  // Уходя с проверки или со страницы, не оставляем запросы висеть.
  useEffect(
    () => () => {
      diagnosisRequestRef.current?.abort();
      questionRequestRef.current?.abort();
      analysisRequestRef.current?.abort();
    },
    [],
  );

  /** Отправляет сообщение агенту в рамках этого диалога и разбирает ответ. */
  async function askAgent(message: string, signal: AbortSignal): Promise<AgentAnswer> {
    if (vehicle === null || session === null) throw new ApiError('unknown');

    const responseText = await sendAgentMessage(
      {
        message,
        vehicle_id: vehicle.vehicle_id,
        engine_model: vehicle.engine_model,
        session_id: session.session_id,
        client_id: conversationId,
      },
      signal,
    );
    const answer = parseAgentAnswer(responseText);
    if (answer === null) throw new ApiError('invalid_response', { httpStatus: 200 });
    return answer;
  }

  function requestAnalysis(diagnosis: DiagnoseResponse) {
    if (vehicle === null || session === null) return;
    // Помощник уже занят: готовит заключение или отвечает на вопрос.
    if (analysisRequestRef.current !== null || questionRequestRef.current !== null) return;

    const controller = new AbortController();
    analysisRequestRef.current = controller;
    dispatch({ type: 'analysis_requested' });

    askAgent(ANALYSIS_REQUEST, controller.signal).then(
      (answer) => {
        if (controller.signal.aborted) return;
        analysisRequestRef.current = null;
        dispatch({ type: 'analysis_received', diagnosis, text: answer.text, draft: answer.draft });
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        analysisRequestRef.current = null;
        const error = toApiError(cause);
        console.error('Заключение помощника не получено:', error, error.serviceDetail ?? '');
        dispatch({ type: 'analysis_failed', diagnosis, text: describeAgentError(error, 'analysis') });
      },
    );
  }

  function requestDiagnosis() {
    if (vehicle === null || session === null) return;
    // Одно заключение за раз, и не поверх вопроса: два одновременных сообщения агент может перепутать.
    if (state.isDiagnosisPending || state.isAnalysisPending || state.isAgentPending) return;

    const request: DiagnoseRequest = { vehicle_id: vehicle.vehicle_id, session_id: session.session_id };
    const controller = new AbortController();
    diagnosisRequestRef.current = controller;
    dispatch({ type: 'diagnosis_requested' });

    // Результат диагностики механику не показывается — его пересказывает агент, который берёт
    // те же данные у ML-сервиса сам. Приложению результат нужен для заявки: по нему решается,
    // предлагать ли её, и из него берутся код неисправности и основания приоритета.
    fetchDiagnosis(request, controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return;
        dispatch({ type: 'diagnosis_received' });
        requestAnalysis(result);
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        const error = toApiError(cause);
        // Подробности — в консоль разработчику; механик видит понятный текст в ленте.
        console.error('Запрос диагностики не выполнен:', error, error.serviceDetail ?? '');
        dispatch({ type: 'diagnosis_failed', text: describeDiagnosisError(error, request) });
      },
    );
  }

  function sendQuestion(text: string) {
    const question = text.trim();
    // Пока помощник занят — отвечает или готовит заключение, — новый вопрос не отправляем:
    // два одновременных сообщения в одном диалоге агент может перепутать.
    if (question === '' || state.isAgentPending || state.isAnalysisPending || state.isDiagnosisPending) return;
    if (vehicle === null || session === null) return;

    const controller = new AbortController();
    questionRequestRef.current = controller;
    dispatch({ type: 'question_sent', text: question });

    askAgent(question, controller.signal).then(
      (answer) => {
        if (controller.signal.aborted) return;
        questionRequestRef.current = null;
        dispatch({ type: 'answer_received', text: answer.text, draft: answer.draft });
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        questionRequestRef.current = null;
        const error = toApiError(cause);
        console.error('Помощник не ответил:', error, error.serviceDetail ?? '');
        dispatch({ type: 'answer_failed', text: describeAgentError(error, 'question') });
      },
    );
  }

  return {
    messages: state.messages,
    isDiagnosisPending: state.isDiagnosisPending,
    isAgentPending: state.isAgentPending,
    isAnalysisPending: state.isAnalysisPending,
    requestDiagnosis,
    requestAnalysis,
    sendQuestion,
    startTicket: (diagnosis) => dispatch({ type: 'ticket_started', diagnosis }),
    closeTicket: (messageId, status) => dispatch({ type: 'ticket_closed', messageId, status }),
  };
}
