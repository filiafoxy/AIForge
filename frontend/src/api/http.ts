// Общий HTTP-слой для внешних сервисов: один POST с JSON и единая классификация сбоев.
// Текстов для интерфейса здесь нет — их подбирает вызывающая сторона по `ApiError.kind`.

/** Сколько ждём ответа сервиса, прежде чем считать запрос зависшим. */
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Причина сбоя запроса.
 *
 * - `not_configured` — адрес сервиса не задан в окружении;
 * - `network` — до сервиса не достучались (не запущен, нет сети, запрет CORS);
 * - `timeout` — сервис не ответил за `REQUEST_TIMEOUT_MS`;
 * - `not_found` — HTTP 404: сервис не знает такие идентификаторы;
 * - `validation` — HTTP 422: тело запроса не по схеме;
 * - `http` — любой другой неуспешный код ответа;
 * - `invalid_response` — ответ успешный, но не того вида, что обещает контракт;
 * - `unknown` — непредвиденная ошибка в самом приложении.
 */
export type ApiErrorKind =
  | 'not_configured'
  | 'network'
  | 'timeout'
  | 'not_found'
  | 'validation'
  | 'http'
  | 'invalid_response'
  | 'unknown';

interface ApiErrorDetails {
  httpStatus?: number;
  /** Поле `detail` из тела ошибки сервиса — для журнала, не для показа механику. */
  serviceDetail?: string | null;
  cause?: unknown;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly httpStatus: number | null;
  readonly serviceDetail: string | null;

  constructor(kind: ApiErrorKind, details: ApiErrorDetails = {}) {
    super(`API error: ${kind}${details.httpStatus ? ` (HTTP ${details.httpStatus})` : ''}`, {
      cause: details.cause,
    });
    this.name = 'ApiError';
    this.kind = kind;
    this.httpStatus = details.httpStatus ?? null;
    this.serviceDetail = details.serviceDetail ?? null;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorKindForStatus(httpStatus: number): ApiErrorKind {
  if (httpStatus === 404) return 'not_found';
  if (httpStatus === 422) return 'validation';
  return 'http';
}

/** Достаёт `detail` из тела ошибки FastAPI: строку при 404, список замечаний при 422. */
async function readServiceDetail(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (!isRecord(body) || body.detail === undefined) return null;
    return typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
  } catch {
    return null;
  }
}

/**
 * Отправляет `POST {baseUrl}{path}` с JSON-телом и возвращает разобранный JSON ответа.
 *
 * Любой сбой превращается в `ApiError`. Исключение одно: если запрос отменила вызывающая
 * сторона через `signal`, наружу уходит исходная ошибка отмены — это не сбой сервиса.
 */
export async function postJson(
  baseUrl: string | null,
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  if (baseUrl === null) throw new ApiError('not_configured');

  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

  // Отмена и таймаут могут сработать и при отправке, и при чтении тела ответа.
  function toTransportError(cause: unknown, fallbackKind: ApiErrorKind): unknown {
    if (signal?.aborted) return cause;
    return new ApiError(timeout.aborted ? 'timeout' : fallbackKind, { cause });
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (cause) {
    throw toTransportError(cause, 'network');
  }

  if (!response.ok) {
    throw new ApiError(errorKindForStatus(response.status), {
      httpStatus: response.status,
      serviceDetail: await readServiceDetail(response),
    });
  }

  try {
    return await response.json();
  } catch (cause) {
    throw toTransportError(cause, 'invalid_response');
  }
}
