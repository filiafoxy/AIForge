// Клиент ML-сервиса диагностики. Контракт: POST /diagnose.

import { mlServiceUrl } from '../config/env';
import type { DiagnoseRequest, DiagnoseResponse, DiagnosisStatus, SignalQuality } from '../types/diagnosis';
import { ApiError, isRecord, postJson } from './http';

const DIAGNOSIS_STATUSES: readonly DiagnosisStatus[] = ['normal', 'anomaly', 'check_failed'];
const SIGNAL_QUALITIES: readonly SignalQuality[] = ['good', 'warning', 'bad'];

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

/** Ответ приходит извне, поэтому его форму проверяем сами, а не верим типам на слово. */
function isDiagnoseResponse(value: unknown): value is DiagnoseResponse {
  return (
    isRecord(value) &&
    typeof value.vehicle_id === 'string' &&
    typeof value.session_id === 'string' &&
    isOneOf(value.status, DIAGNOSIS_STATUSES) &&
    isStringOrNull(value.anomaly_type) &&
    isStringOrNull(value.anomaly_title) &&
    isNumberOrNull(value.anomaly_score) &&
    isNumberOrNull(value.confidence) &&
    isOneOf(value.signal_quality, SIGNAL_QUALITIES) &&
    typeof value.description === 'string' &&
    typeof value.model_version === 'string'
  );
}

/**
 * Запрашивает результат диагностики для пары «машина — проверка».
 *
 * @throws ApiError при любом сбое; ошибку отмены — если запрос отменён через `signal`.
 */
export async function fetchDiagnosis(request: DiagnoseRequest, signal?: AbortSignal): Promise<DiagnoseResponse> {
  const body = await postJson(mlServiceUrl, '/diagnose', request, signal);

  // Результат по чужой паре идентификаторов опаснее, чем отсутствие результата.
  const isForThisRequest =
    isDiagnoseResponse(body) && body.vehicle_id === request.vehicle_id && body.session_id === request.session_id;
  if (!isForThisRequest) {
    throw new ApiError('invalid_response', { httpStatus: 200 });
  }
  return body;
}
