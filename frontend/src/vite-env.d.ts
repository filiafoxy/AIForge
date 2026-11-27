/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Базовый адрес Mock ML API (`POST /diagnose`). */
  readonly VITE_MOCK_ML_URL?: string;
  /** Базовый адрес Mock ТОиР (`POST /tickets`). */
  readonly VITE_MOCK_TOIR_URL?: string;
  /** Полный адрес вебхука ИИ-агента (`POST`). */
  readonly VITE_AGENT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
