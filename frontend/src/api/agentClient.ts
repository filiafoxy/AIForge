// Клиент ИИ-агента. Контракт: POST на адрес вебхука, в теле — вопрос и сведения о проверке.

import { agentUrl } from '../config/env';
import type { AgentRequest } from '../types/agent';
import { ApiError, isRecord, postForText } from './http';

/**
 * Поля, в которых может лежать текст ответа. Формат ответа с командой агента не закреплён,
 * поэтому принимаем распространённые варианты; `output` — то, что по умолчанию отдаёт агент в n8n.
 */
const ANSWER_FIELDS = ['text', 'output', 'answer', 'response', 'message'] as const;

function toNonEmptyText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text === '' ? null : text;
}

/** Ищет текст ответа в разобранном JSON: строка, объект с одним из известных полей или список таких объектов. */
function findAnswerText(body: unknown): string | null {
  if (typeof body === 'string') return toNonEmptyText(body);

  if (Array.isArray(body)) {
    for (const item of body) {
      const text = findAnswerText(item);
      if (text !== null) return text;
    }
    return null;
  }

  if (isRecord(body)) {
    for (const field of ANSWER_FIELDS) {
      const text = toNonEmptyText(body[field]);
      if (text !== null) return text;
    }
  }
  return null;
}

/** Достаёт текст ответа из тела: JSON в одном из принятых видов или обычный текст. */
function readAnswer(responseText: string): string | null {
  let body: unknown;
  try {
    body = JSON.parse(responseText);
  } catch {
    // Не JSON — значит, агент ответил обычным текстом. Страница HTML ответом быть не может:
    // так выглядит заглушка прокси или страница входа, а не слова агента.
    const text = responseText.trim();
    return text === '' || text.startsWith('<') ? null : text;
  }
  return findAnswerText(body);
}

/**
 * Отправляет вопрос агенту и возвращает текст его ответа.
 *
 * Время ожидания не ограничено: агент ищет по руководствам и обращается к языковой модели,
 * заключение занимает несколько минут, и верхней границы у этого времени нет. Запрос кончается
 * ответом, обрывом соединения (его может разорвать и шлюз перед агентом) или отменой через `signal`.
 *
 * @throws ApiError при любом сбое; ошибку отмены — если запрос отменён через `signal`.
 */
export async function sendAgentMessage(request: AgentRequest, signal?: AbortSignal): Promise<string> {
  const responseText = await postForText(agentUrl, request, { signal, timeoutMs: null });

  const answer = readAnswer(responseText);
  if (answer === null) {
    throw new ApiError('invalid_response', { httpStatus: 200 });
  }
  return answer;
}
