// Контракт ИИ-агента: тело запроса к вебхуку.

export interface AgentRequest {
  /** Вопрос механика. */
  message: string;
  vehicle_id: string;
  /** Двигатель выбранной машины: по нему агент ищет только в руководствах этого двигателя. */
  engine_model: string;
  session_id: string;
  /** Идентификатор диалога: по нему агент связывает сообщения одного разговора. */
  client_id: string;
}
