// Адреса внешних сервисов (FR-15).
// Единственное место, где читаются переменные VITE_*; значений по умолчанию в коде нет.
// Чтобы перейти с Mock ML на рабочий сервис, достаточно поменять значение VITE_MOCK_ML_URL.

function normalizeBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim().replace(/\/+$/, '') ?? '';
  return trimmed === '' ? null : trimmed;
}

/** Базовый адрес Mock ML API без завершающего `/`; `null`, если переменная не задана. */
export const mlServiceUrl = normalizeBaseUrl(import.meta.env.VITE_MOCK_ML_URL);

/** Базовый адрес Mock ТОиР без завершающего `/`; `null`, если переменная не задана. */
export const toirServiceUrl = normalizeBaseUrl(import.meta.env.VITE_MOCK_TOIR_URL);

/** Полный адрес вебхука ИИ-агента; `null`, если переменная не задана. */
export const agentUrl = normalizeBaseUrl(import.meta.env.VITE_AGENT_URL);

const SERVICE_URLS: ReadonlyArray<readonly [variableName: string, url: string | null]> = [
  ['VITE_MOCK_ML_URL', mlServiceUrl],
  ['VITE_MOCK_TOIR_URL', toirServiceUrl],
  ['VITE_AGENT_URL', agentUrl],
];

/** Имена незаданных переменных — для подсказки в интерфейсе. */
export const missingEnvVars: string[] = SERVICE_URLS.filter(([, url]) => url === null).map(([name]) => name);

/** Адрес этого же компьютера: к нему браузер пускает и по `http://` со страницы HTTPS. */
const LOOPBACK_URL = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i;

/** Заблокирует ли браузер запрос на этот адрес со страницы, открытой по HTTPS (смешанное содержимое). */
export function isBlockedOnHttpsPage(url: string): boolean {
  return url.toLowerCase().startsWith('http://') && !LOOPBACK_URL.test(url);
}

/**
 * Имена переменных с адресами, запросы на которые браузер заблокирует:
 * страница открыта по HTTPS, а адрес сервиса задан по `http://`.
 *
 * @param pageProtocol Протокол страницы, как в `window.location.protocol` (`https:`).
 */
export function findInsecureEnvVars(pageProtocol: string): string[] {
  if (pageProtocol !== 'https:') return [];
  return SERVICE_URLS.filter(([, url]) => url !== null && isBlockedOnHttpsPage(url)).map(([name]) => name);
}
