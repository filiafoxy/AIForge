// Контракт ИИ-агента: тело запроса к вебхуку и черновик заявки из его ответа.

export interface AgentRequest {
  /** Вопрос механика или короткий запрос заключения по результату диагностики. */
  message: string;
  vehicle_id: string;
  /** Двигатель выбранной машины: по нему агент ищет только в руководствах этого двигателя. */
  engine_model: string;
  session_id: string;
  /** Идентификатор диалога: по нему агент связывает сообщения одного разговора. */
  client_id: string;
}

/** Ссылка на руководство в том виде, как её назвал агент. Проверяется по списку руководств двигателя. */
export interface AgentReference {
  manual: string;
  page: number;
}

/**
 * Черновик заявки, который предложил агент. Это предложение, а не готовая заявка:
 * форма показывает его механику, а отправляет только то, что механик подтвердил.
 */
export interface AgentTicketDraft {
  conclusion: string | null;
  operations: string[];
  spareParts: string[];
  references: AgentReference[];
}
