import { getVehicleName } from '../../data/fleet';
import type { Vehicle } from '../../types/fleet';
import styles from './VehicleSummary.module.css';

interface VehicleSummaryProps {
  vehicle: Vehicle;
}

/** Карточка выбранной машины: госномер и сведения, по которым механик убеждается, что машина та. */
export function VehicleSummary({ vehicle }: VehicleSummaryProps) {
  const details = [
    { label: 'Двигатель', value: vehicle.engine_model },
    { label: 'Машина', value: `${getVehicleName(vehicle)}, ${vehicle.vehicle_type}` },
    { label: 'Топливо', value: vehicle.fuel },
    { label: 'Гаражный №', value: vehicle.garage_no },
  ];

  return (
    <div className={styles.summary}>
      <p className={styles.plate}>{vehicle.vehicle_id}</p>
      <dl className={styles.details}>
        {details.map(({ label, value }) => (
          <div key={label} className={styles.detail}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
