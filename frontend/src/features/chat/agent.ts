// Обращение к ИИ-агенту.
//
// Агент ещё не подключён, поэтому здесь заглушка: она честно сообщает об этом и ничего
// никуда не отправляет. Когда у агента появятся адрес и формат обмена, изменится только
// `askAgent`: она начнёт вызывать клиент из `src/api/`. Лента диалога останется прежней.

import type { DiagnoseResponse } from '../../types/diagnosis';
import type { Session, Vehicle } from '../../types/fleet';

/** Вопрос механика и всё, что агенту нужно знать о текущей проверке. */
export interface AgentQuestion {
  text: string;
  /** Машина нужна агенту, чтобы искать только в руководствах её двигателя. */
  vehicle: Vehicle;
  session: Session;
  /** Последний результат диагностики по этой проверке; `null`, если его ещё не запрашивали. */
  diagnosis: DiagnoseResponse | null;
}

export interface AgentAnswer {
  text: string;
}

/** Пауза заглушки: с ней состояние ожидания ответа видно в интерфейсе и его можно проверить. */
const STUB_DELAY_MS = 500;

const STUB_ANSWER =
  'Помощник пока не подключён: база знаний по руководствам ещё настраивается. ' +
  'Ответить на вопрос сейчас некому, ваше сообщение никуда не отправлено. ' +
  'Результат диагностики от этого не зависит — его можно получить кнопкой над диалогом.';

/**
 * Отправляет вопрос агенту и возвращает его ответ.
 * Сейчас это заглушка: вопрос не используется, ответ всегда один.
 */
export async function askAgent(_question: AgentQuestion, signal?: AbortSignal): Promise<AgentAnswer> {
  await wait(STUB_DELAY_MS, signal);
  return { text: STUB_ANSWER };
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}
