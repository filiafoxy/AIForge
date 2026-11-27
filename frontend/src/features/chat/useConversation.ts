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
import type { ImageAttachment } from './imageAttachments';

/** Сообщение агенту, когда механик приложил изображения и ничего не написал. */
const IMAGES_ONLY_MESSAGE = 'Изображения во вложении.';

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
  /**
   * Отправляет вопрос помощнику, при желании — с изображениями. Пока ждём ответ на предыдущий,
   * новый не принимается. Изображения переходят диалогу: он освобождает их адреса `blob:`.
   */
  sendQuestion: (text: string, images?: readonly ImageAttachment[]) => void;
  /**
   * Результат диагностики этой проверки, если он уже получен: по кнопке диагностики или втихую при
   * первом вопросе механика. Нужен ленте, чтобы предложить заявку и после вопроса, заданного
   * без кнопки.
   */
  diagnosis: DiagnoseResponse | null;
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
  // Тихий запрос результата диагностики при первом вопросе. Не блокирует ни вопрос, ни кнопки.
  const backgroundDiagnosisRef = useRef<AbortController | null>(null);
  // Запросы к агенту: пока один выполняется, второй не отправляется. Занятость проверяется по ссылкам,
  // а не по состоянию: заключение запрашивается из обработчика ответа диагностики, где состояние
  // уже устарело. По завершении запроса ссылка обнуляется.
  const analysisRequestRef = useRef<AbortController | null>(null);
  // Адреса `blob:` миниатюр изображений из ленты: освобождаются, когда диалог закрывается.
  const imageUrlsRef = useRef<string[]>([]);

  // Уходя с проверки или со страницы, не оставляем запросы висеть и освобождаем память под изображения.
  useEffect(
    () => () => {
      diagnosisRequestRef.current?.abort();
      backgroundDiagnosisRef.current?.abort();
      questionRequestRef.current?.abort();
      analysisRequestRef.current?.abort();
      imageUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      imageUrlsRef.current = [];
    },
    [],
  );

  /** Отправляет сообщение агенту в рамках этого диалога и разбирает ответ. */
  async function askAgent(message: string, signal: AbortSignal, files: readonly File[] = []): Promise<AgentAnswer> {
    if (vehicle === null || session === null) throw new ApiError('unknown');

    const responseText = await sendAgentMessage(
      {
        message,
        vehicle_id: vehicle.vehicle_id,
        engine_model: vehicle.engine_model,
        session_id: session.session_id,
        client_id: conversationId,
      },
      { signal, files },
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
        dispatch({ type: 'analysis_received', diagnosis, answer });
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
        dispatch({ type: 'diagnosis_received', diagnosis: result });
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

  /**
   * Узнаёт результат диагностики, если механик начал с вопроса, а не с кнопки диагностики.
   * Заявка по ответу помощника возможна, только когда приложение знает результат (достоверно ли
   * отклонение, какой код неисправности). Ничего не показывает: механик видит только ответ помощника.
   * Сбой не страшен — заявка в этом случае не предлагается, а следующий вопрос запросит результат снова.
   */
  function loadDiagnosisInBackground() {
    if (vehicle === null || session === null) return;
    if (state.diagnosis !== null || backgroundDiagnosisRef.current !== null) return;

    const request: DiagnoseRequest = { vehicle_id: vehicle.vehicle_id, session_id: session.session_id };
    const controller = new AbortController();
    backgroundDiagnosisRef.current = controller;

    fetchDiagnosis(request, controller.signal).then(
      (diagnosis) => {
        if (controller.signal.aborted) return;
        backgroundDiagnosisRef.current = null;
        dispatch({ type: 'diagnosis_known', diagnosis });
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        backgroundDiagnosisRef.current = null;
        const error = toApiError(cause);
        console.error('Результат диагностики для заявки не получен:', error, error.serviceDetail ?? '');
      },
    );
  }

  function sendQuestion(text: string, images: readonly ImageAttachment[] = []) {
    const question = text.trim();
    // Пока помощник занят — отвечает или готовит заключение, — новый вопрос не отправляем:
    // два одновременных сообщения в одном диалоге агент может перепутать.
    const isRejected =
      (question === '' && images.length === 0) ||
      state.isAgentPending ||
      state.isAnalysisPending ||
      state.isDiagnosisPending ||
      vehicle === null ||
      session === null;
    if (isRejected) {
      // Изображения переданы нам; раз сообщение не уходит, адреса миниатюр освобождаем сразу.
      images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return;
    }

    // Адреса миниатюр живут, пока открыт диалог: сообщение остаётся в ленте.
    images.forEach((image) => imageUrlsRef.current.push(image.previewUrl));

    // Ответ помощника может оказаться заключением по проверке, и тогда под ним нужна кнопка заявки.
    loadDiagnosisInBackground();

    const controller = new AbortController();
    questionRequestRef.current = controller;
    dispatch({
      type: 'question_sent',
      text: question,
      images: images.map((image) => ({ name: image.file.name, url: image.previewUrl })),
    });

    // У сообщения с одними изображениями текста нет, а агенту нужно хоть какое-то сообщение.
    const message = question !== '' ? question : IMAGES_ONLY_MESSAGE;
    askAgent(
      message,
      controller.signal,
      images.map((image) => image.file),
    ).then(
      (answer) => {
        if (controller.signal.aborted) return;
        questionRequestRef.current = null;
        dispatch({ type: 'answer_received', answer });
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
    diagnosis: state.diagnosis,
    startTicket: (diagnosis) => dispatch({ type: 'ticket_started', diagnosis }),
    closeTicket: (messageId, status) => dispatch({ type: 'ticket_closed', messageId, status }),
  };
}
