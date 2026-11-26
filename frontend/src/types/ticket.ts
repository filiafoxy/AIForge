// Контракт Mock ТОиР: neurodvs_mock/openapi_toir.json, POST /tickets.

export type TicketUrgency = 'low' | 'medium' | 'high';

export interface TicketReference {
  /** Название или обозначение документа из базы знаний. */
  manual: string;
  /** Номер страницы PDF, от 1. */
  pdf_page: number;
}

export interface TicketRequest {
  vehicle_id: string;
  session_id: string;
  /** Значение `anomaly_type` из ответа `/diagnose`: `F01`…`F14`. */
  anomaly_type: string;
  /** Диагноз, непустая строка. */
  conclusion: string;
  urgency: TicketUrgency;
  /** Работы, непустой список. */
  operations: string[];
  /** Запчасти, список может быть пустым. */
  spare_parts: string[];
  /** Ссылки на источники, непустой список. */
  references: TicketReference[];
}

export interface TicketResponse {
  ticket_id: string;
  status: 'created';
}
