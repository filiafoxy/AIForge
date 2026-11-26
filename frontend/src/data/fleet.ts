// Парк и справочник неисправностей.
// JSON-файлы рядом — копии neurodvs_mock/data/*.json; mock-сервер список ТС не отдаёт.

import type { FaultType, Vehicle } from '../types/fleet';
import faultTypesFile from './fault_types.json';
import vehiclesFile from './vehicles.json';

export const vehicles: readonly Vehicle[] = vehiclesFile.vehicles.map((vehicle) => ({
  vehicle_id: vehicle.vehicle_id,
  garage_no: vehicle.garage_no,
  make: vehicle.make,
  model: vehicle.model,
  vehicle_type: vehicle.vehicle_type,
  engine_model: vehicle.engine_model,
  fuel: vehicle.fuel,
  // Результат проверки из файла отбрасываем: его источник — ML-сервис (FR-01).
  sessions: vehicle.sessions.map(({ session_id, checked_at }) => ({ session_id, checked_at })),
}));

export const faultTypes: readonly FaultType[] = faultTypesFile;

/** Название машины для интерфейса. У МАЗ с ЯМЗ-536 модель не указана — тогда показываем марку. */
export function getVehicleName(vehicle: Vehicle): string {
  return vehicle.model ?? vehicle.make;
}
