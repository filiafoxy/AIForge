import { REQUEST_TIMEOUT_MS } from '../../api/http';
import type { ApiError } from '../../api/http';
import type { DiagnoseRequest } from '../../types/diagnosis';

/** Объясняет механику, почему не пришёл результат диагностики и что делать дальше. */
export function describeDiagnosisError(error: ApiError, request: DiagnoseRequest): string {
  switch (error.kind) {
    case 'not_configured':
      return 'Адрес сервиса диагностики не задан в настройках приложения. Обратитесь к администратору.';
    case 'offline':
      return 'Нет подключения к сети, запрос не отправлен. Когда связь появится, запросите результат ещё раз.';
    case 'network':
      return 'Сервис диагностики недоступен. Проверьте, что он запущен и есть связь, и повторите запрос.';
    case 'timeout':
      return `Сервис диагностики не ответил за ${REQUEST_TIMEOUT_MS / 1000} секунд. Повторите запрос.`;
    case 'not_found':
      return (
        `Сервис диагностики не знает машину ${request.vehicle_id} или её проверку ${request.session_id}. ` +
        'Возможно, список машин в приложении устарел.'
      );
    case 'validation':
      return 'Сервис диагностики отклонил запрос: данные переданы не в том виде, которого он ждёт.';
    case 'http':
      return `Сервис диагностики ответил ошибкой (код ${error.httpStatus ?? 'неизвестен'}). Повторите запрос позже.`;
    case 'invalid_response':
      return 'Сервис диагностики прислал ответ, который приложение не смогло разобрать.';
    case 'unknown':
      return 'Не удалось получить результат диагностики. Повторите запрос.';
  }
}
