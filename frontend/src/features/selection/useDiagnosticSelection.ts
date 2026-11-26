import { useCallback, useState } from 'react';
import type { Session, Vehicle } from '../../types/fleet';

interface SelectionIds {
  vehicleId: string | null;
  sessionId: string | null;
}

export interface DiagnosticSelection {
  /** Выбранная машина целиком: `engine_model` из карточки нужна для подбора руководства. */
  vehicle: Vehicle | null;
  /** Выбранная проверка. Всегда принадлежит `vehicle`. */
  session: Session | null;
  /** Выбор другой машины сбрасывает проверку; повторный выбор той же — ничего не меняет. */
  selectVehicle: (vehicleId: string) => void;
  selectSession: (sessionId: string) => void;
}

/**
 * Состояние выбора «машина → проверка».
 *
 * Хранятся только идентификаторы, а сами объекты каждый раз ищутся в `vehicles`.
 * Проверка ищется внутри выбранной машины, поэтому пара «машина и чужая проверка» невозможна.
 */
export function useDiagnosticSelection(vehicles: readonly Vehicle[]): DiagnosticSelection {
  const [ids, setIds] = useState<SelectionIds>({ vehicleId: null, sessionId: null });

  const vehicle = vehicles.find((candidate) => candidate.vehicle_id === ids.vehicleId) ?? null;
  const session = vehicle?.sessions.find((candidate) => candidate.session_id === ids.sessionId) ?? null;

  const selectVehicle = useCallback((vehicleId: string) => {
    setIds((current) => (current.vehicleId === vehicleId ? current : { vehicleId, sessionId: null }));
  }, []);

  const selectSession = useCallback((sessionId: string) => {
    setIds((current) => ({ ...current, sessionId }));
  }, []);

  return { vehicle, session, selectVehicle, selectSession };
}
