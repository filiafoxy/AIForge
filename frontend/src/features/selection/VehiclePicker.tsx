import { useId, useState } from 'react';
import { getVehicleName } from '../../data/fleet';
import type { Vehicle } from '../../types/fleet';
import { filterVehiclesByPlate } from './plateSearch';
import styles from './VehiclePicker.module.css';

interface VehiclePickerProps {
  vehicles: readonly Vehicle[];
  /** Текущая машина — подсвечивается в списке, когда механик меняет выбор. */
  selectedVehicleId: string | null;
  onSelect: (vehicleId: string) => void;
}

/** Список машин парка с поиском по госномеру. */
export function VehiclePicker({ vehicles, selectedVehicleId, onSelect }: VehiclePickerProps) {
  const [query, setQuery] = useState('');
  const searchId = useId();
  const matchingVehicles = filterVehiclesByPlate(vehicles, query);

  return (
    <div className={styles.picker}>
      <div className={styles.search}>
        <label htmlFor={searchId} className={styles.searchLabel}>
          Поиск по госномеру
        </label>
        <input
          id={searchId}
          type="search"
          className={styles.searchInput}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Например, M333"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
        <p role="status" className={styles.count}>
          Показано {matchingVehicles.length} из {vehicles.length}
        </p>
      </div>

      {matchingVehicles.length === 0 ? (
        <p className={styles.empty}>Машины с таким номером в парке нет.</p>
      ) : (
        <ul className={styles.list}>
          {matchingVehicles.map((vehicle) => (
            <li key={vehicle.vehicle_id}>
              <button
                type="button"
                className={styles.item}
                aria-current={vehicle.vehicle_id === selectedVehicleId ? 'true' : undefined}
                onClick={() => onSelect(vehicle.vehicle_id)}
              >
                <span className={styles.plate}>{vehicle.vehicle_id}</span>
                <span className={styles.engine}>{vehicle.engine_model}</span>
                <span className={styles.meta}>
                  {getVehicleName(vehicle)} · {vehicle.garage_no}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
