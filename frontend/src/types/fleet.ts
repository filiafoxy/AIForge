// Форма данных парка: neurodvs_mock/data/vehicles.json и fault_types.json.

/**
 * Проверка из истории ТС.
 *
 * В vehicles.json у проверки записан и сам результат диагностики, но сюда он
 * намеренно не попадает: результат приложение получает только от ML-сервиса (FR-01).
 */
export interface Session {
  session_id: string;
  /** Дата и время проверки, ISO 8601 со смещением: `2026-10-29T15:20:00+03:00`. */
  checked_at: string;
}

export interface Vehicle {
  /** Госномер латиницей, регистр важен: `M333YK47`. */
  vehicle_id: string;
  garage_no: string;
  make: string;
  /** `null` у МАЗ с двигателем ЯМЗ-536. */
  model: string | null;
  vehicle_type: string;
  /** По модели двигателя выбирается руководство; в ответе ML её нет. */
  engine_model: string;
  fuel: string;
  /** От ранней проверки к поздней. */
  sessions: Session[];
}

export interface FaultType {
  /** Условный код `F01`…`F14`; в руководствах таких кодов нет. */
  code: string;
  title: string;
}
