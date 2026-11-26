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

/** Имена незаданных переменных — для подсказки в интерфейсе. */
export const missingEnvVars: string[] = [];
if (mlServiceUrl === null) missingEnvVars.push('VITE_MOCK_ML_URL');
if (toirServiceUrl === null) missingEnvVars.push('VITE_MOCK_TOIR_URL');
