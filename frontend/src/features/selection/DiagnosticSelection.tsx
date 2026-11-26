import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Panel } from '../../components/Panel';
import type { Session, Vehicle } from '../../types/fleet';
import { SessionPicker } from './SessionPicker';
import { VehiclePicker } from './VehiclePicker';
import { VehicleSummary } from './VehicleSummary';
import styles from './DiagnosticSelection.module.css';

interface DiagnosticSelectionProps {
  vehicles: readonly Vehicle[];
  vehicle: Vehicle | null;
  session: Session | null;
  onSelectVehicle: (vehicleId: string) => void;
  onSelectSession: (sessionId: string) => void;
}

/**
 * Два шага выбора: машина, затем её проверка.
 *
 * После выбора машины список сворачивается в карточку, чтобы на телефоне проверки
 * были сразу под рукой. «Сменить» снова открывает список; текущий выбор при этом
 * сохраняется, пока механик не укажет другую машину.
 */
export function DiagnosticSelection({
  vehicles,
  vehicle,
  session,
  onSelectVehicle,
  onSelectSession,
}: DiagnosticSelectionProps) {
  const [isChangingVehicle, setIsChangingVehicle] = useState(false);
  const vehicleHeadingRef = useRef<HTMLHeadingElement>(null);

  // Кнопка, по которой нажали, исчезает вместе со старым содержимым блока.
  // Переводим фокус на заголовок: он остаётся на месте, поэтому клавиатура
  // и экранный диктор не теряют позицию на странице.
  function showVehicleList(isShown: boolean) {
    setIsChangingVehicle(isShown);
    vehicleHeadingRef.current?.focus();
  }

  function handleSelectVehicle(vehicleId: string) {
    onSelectVehicle(vehicleId);
    showVehicleList(false);
  }

  let vehicleAction: ReactNode = null;
  let vehicleContent: ReactNode;
  if (vehicle !== null && !isChangingVehicle) {
    vehicleAction = <Button onClick={() => showVehicleList(true)}>Сменить</Button>;
    vehicleContent = <VehicleSummary vehicle={vehicle} />;
  } else {
    // «Отмена» нужна, только если есть к чему вернуться.
    if (vehicle !== null) {
      vehicleAction = <Button onClick={() => showVehicleList(false)}>Отмена</Button>;
    }
    vehicleContent = (
      <VehiclePicker
        vehicles={vehicles}
        selectedVehicleId={vehicle?.vehicle_id ?? null}
        onSelect={handleSelectVehicle}
      />
    );
  }

  return (
    <div className={styles.steps}>
      <Panel title="Машина" headingRef={vehicleHeadingRef} action={vehicleAction}>
        {vehicleContent}
      </Panel>

      <Panel title="Проверка">
        {vehicle === null ? (
          <p className={styles.hint}>Сначала выберите машину.</p>
        ) : (
          <SessionPicker
            vehicleId={vehicle.vehicle_id}
            sessions={vehicle.sessions}
            selectedSessionId={session?.session_id ?? null}
            onSelect={onSelectSession}
          />
        )}
      </Panel>
    </div>
  );
}
