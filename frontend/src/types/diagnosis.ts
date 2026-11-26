// Контракт Mock ML API: neurodvs_mock/openapi_ml.json, POST /diagnose.

export type DiagnosisStatus = 'normal' | 'anomaly' | 'check_failed';

/** `warning` — запись с помехами, уверенность снижена; `bad` — запись непригодна. */
export type SignalQuality = 'good' | 'warning' | 'bad';

export interface DiagnoseRequest {
  vehicle_id: string;
  session_id: string;
}

export interface DiagnoseResponse {
  vehicle_id: string;
  session_id: string;
  status: DiagnosisStatus;
  /** Код `F01`…`F14`; `null` при `normal` и `check_failed`. */
  anomaly_type: string | null;
  /** Название типа из справочника; `null` при `normal` и `check_failed`. */
  anomaly_title: string | null;
  /** От 0 до 1; `null` при `check_failed`. */
  anomaly_score: number | null;
  /** От 0 до 1; `null` при `check_failed`. */
  confidence: number | null;
  signal_quality: SignalQuality;
  description: string;
  model_version: string;
}
