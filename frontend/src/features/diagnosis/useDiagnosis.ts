import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/http';
import { fetchDiagnosis } from '../../api/mlClient';
import type { DiagnoseRequest, DiagnoseResponse } from '../../types/diagnosis';

/** Состояние запроса диагностики. Всё, кроме `idle`, помнит, для какой пары оно получено. */
export type DiagnosisState =
  | { status: 'idle' }
  | { status: 'loading'; request: DiagnoseRequest }
  | { status: 'success'; request: DiagnoseRequest; result: DiagnoseResponse }
  | { status: 'error'; request: DiagnoseRequest; error: ApiError };

const IDLE: DiagnosisState = { status: 'idle' };

function isSameRequest(a: DiagnoseRequest, b: DiagnoseRequest): boolean {
  return a.vehicle_id === b.vehicle_id && a.session_id === b.session_id;
}

interface UseDiagnosisResult {
  /** Состояние для текущего выбора. Результат другой пары сюда не попадает. */
  diagnosis: DiagnosisState;
  /** Отправляет запрос по текущему выбору. Без выбора ничего не делает. */
  requestDiagnosis: () => void;
}

/**
 * Запрос результата диагностики для выбранной пары «машина — проверка».
 *
 * Состояние хранится вместе с парой, для которой оно получено, а наружу отдаётся,
 * только если пара совпадает с текущим выбором. Поэтому при смене машины или проверки
 * старый результат исчезает сам, и сбрасывать его вручную не нужно.
 *
 * @param selection Текущий выбор или `null`, пока выбраны не обе позиции.
 */
export function useDiagnosis(selection: DiagnoseRequest | null): UseDiagnosisResult {
  const [stored, setStored] = useState<DiagnosisState>(IDLE);
  const activeRequestRef = useRef<AbortController | null>(null);

  // Уходя со страницы, не оставляем запрос висеть.
  useEffect(() => () => activeRequestRef.current?.abort(), []);

  async function runRequest(request: DiagnoseRequest) {
    // Новый запрос отменяет предыдущий: в состояние попадает ответ только на последний.
    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;

    setStored({ status: 'loading', request });
    try {
      const result = await fetchDiagnosis(request, controller.signal);
      if (!controller.signal.aborted) setStored({ status: 'success', request, result });
    } catch (cause) {
      if (controller.signal.aborted) return;
      const error = cause instanceof ApiError ? cause : new ApiError('unknown', { cause });
      // Подробности — в консоль разработчику; механик видит понятный текст на странице.
      console.error('Запрос диагностики не выполнен:', error, error.serviceDetail ?? '');
      setStored({ status: 'error', request, error });
    }
  }

  function requestDiagnosis() {
    if (selection === null) return;
    // Копируем поля: состояние не должно зависеть от объекта, которым владеет вызывающий код.
    void runRequest({ vehicle_id: selection.vehicle_id, session_id: selection.session_id });
  }

  const isForCurrentSelection =
    stored.status !== 'idle' && selection !== null && isSameRequest(stored.request, selection);

  return { diagnosis: isForCurrentSelection ? stored : IDLE, requestDiagnosis };
}
