import { AGENT_TIMEOUT_MS } from '../../api/agentClient';
import type { ApiError } from '../../api/http';

/** Объясняет механику, почему помощник не ответил и что делать дальше. */
export function describeAgentError(error: ApiError): string {
  switch (error.kind) {
    case 'not_configured':
      return 'Адрес помощника не задан в настройках приложения. Обратитесь к администратору.';
    case 'network':
      return 'Помощник недоступен. Проверьте связь и отправьте сообщение ещё раз.';
    case 'timeout':
      return `Помощник не ответил за ${AGENT_TIMEOUT_MS / 1000} секунд. Отправьте сообщение ещё раз.`;
    case 'not_found':
      return 'Помощник не найден по адресу из настроек приложения. Обратитесь к администратору.';
    case 'validation':
      return 'Помощник отклонил сообщение: данные переданы не в том виде, которого он ждёт.';
    case 'http':
      return `Помощник ответил ошибкой (код ${error.httpStatus ?? 'неизвестен'}). Отправьте сообщение ещё раз позже.`;
    case 'invalid_response':
      return 'Помощник прислал ответ, который приложение не смогло разобрать.';
    case 'unknown':
      return 'Помощник не ответил. Отправьте сообщение ещё раз.';
  }
}
