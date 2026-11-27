import type { ApiError } from '../../api/http';

/**
 * Что просили у помощника: ответ на вопрос механика или заключение по результату диагностики.
 * От этого зависит совет, что делать после сбоя.
 */
export type AgentRequestKind = 'question' | 'analysis';

const RETRY_ADVICE: Record<AgentRequestKind, string> = {
  question: 'отправьте сообщение ещё раз',
  analysis: 'запросите заключение ещё раз',
};

/** Объясняет механику, почему помощник не ответил и что делать дальше. */
export function describeAgentError(error: ApiError, requestKind: AgentRequestKind): string {
  const retry = RETRY_ADVICE[requestKind];
  const retrySentence = `${retry.charAt(0).toLocaleUpperCase('ru-RU')}${retry.slice(1)}`;

  switch (error.kind) {
    case 'not_configured':
      return 'Адрес помощника не задан в настройках приложения. Обратитесь к администратору.';
    case 'offline':
      return `Нет подключения к сети, запрос помощнику не отправлен. Когда связь появится, ${retry}.`;
    case 'network':
      return `Помощник недоступен. Проверьте связь и ${retry}.`;
    case 'timeout':
      // Своего ограничения по времени у запроса к помощнику нет; ветка остаётся на случай, если оно появится.
      return `Помощник не успел ответить. ${retrySentence}.`;
    case 'not_found':
      return 'Помощник не найден по адресу из настроек приложения. Обратитесь к администратору.';
    case 'validation':
      return 'Помощник отклонил запрос: данные переданы не в том виде, которого он ждёт.';
    case 'http':
      return `Помощник ответил ошибкой (код ${error.httpStatus ?? 'неизвестен'}). ${retrySentence} позже.`;
    case 'invalid_response':
      return 'Помощник прислал ответ, который приложение не смогло разобрать.';
    case 'unknown':
      return `Помощник не ответил. ${retrySentence}.`;
  }
}
