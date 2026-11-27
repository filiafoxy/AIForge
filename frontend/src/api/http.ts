// Общий HTTP-слой для внешних сервисов: один POST с JSON и единая классификация сбоев.
// Текстов для интерфейса здесь нет — их подбирает вызывающая сторона по `ApiError.kind`.

/** Сколько ждём ответа сервиса, прежде чем считать запрос зависшим. Клиент может задать своё время. */
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Причина сбоя запроса.
 *
 * - `not_configured` — адрес сервиса не задан в окружении;
 * - `network` — до сервиса не достучались (не запущен, нет сети, запрет CORS);
 * - `timeout` — сервис не ответил за отведённое время;
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

/**
 * Достаёт пояснение из тела ошибки: `detail` у FastAPI (строка при 404, список замечаний при 422)
 * или `message` у n8n.
 */
async function readServiceDetail(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (!isRecord(body)) return null;
    const detail = body.detail ?? body.message;
    if (detail === undefined) return null;
    return typeof detail === 'string' ? detail : JSON.stringify(detail);
  } catch {
    return null;
  }
}

interface PostOptions {
  /** Отмена запроса вызывающей стороной. */
  signal?: AbortSignal;
  /** Сколько ждать ответа; по умолчанию `REQUEST_TIMEOUT_MS`. */
  timeoutMs?: number;
}

/**
 * Отправляет `POST` с JSON-телом на адрес `url` и возвращает тело ответа текстом, как оно пришло.
 *
 * Любой сбой превращается в `ApiError`. Исключение одно: если запрос отменила вызывающая
 * сторона через `signal`, наружу уходит исходная ошибка отмены — это не сбой сервиса.
 */
export async function postForText(url: string | null, body: unknown, options: PostOptions = {}): Promise<string> {
  if (url === null) throw new ApiError('not_configured');

  const { signal, timeoutMs = REQUEST_TIMEOUT_MS } = options;
  const timeout = AbortSignal.timeout(timeoutMs);

  // Отмена и таймаут могут сработать и при отправке, и при чтении тела ответа.
  function toTransportError(cause: unknown, fallbackKind: ApiErrorKind): unknown {
    if (signal?.aborted) return cause;
    return new ApiError(timeout.aborted ? 'timeout' : fallbackKind, { cause });
  }

  let response: Response;
  try {
    response = await fetch(url, {
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
    return await response.text();
  } catch (cause) {
    throw toTransportError(cause, 'invalid_response');
  }
}

/**
 * Отправляет `POST {baseUrl}{path}` с JSON-телом и возвращает разобранный JSON ответа.
 *
 * @throws ApiError при любом сбое; ошибку отмены — если запрос отменён через `signal`.
 */
export async function postJson(
  baseUrl: string | null,
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  const text = await postForText(baseUrl === null ? null : `${baseUrl}${path}`, body, { signal });
  try {
    return JSON.parse(text) as unknown;
  } catch (cause) {
    throw new ApiError('invalid_response', { httpStatus: 200, cause });
  }
}
