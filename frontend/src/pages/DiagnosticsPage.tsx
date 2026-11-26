import { useId } from 'react';
import { Button } from '../components/Button';
import { vehicles } from '../data/fleet';
import { DiagnosisOutcome } from '../features/diagnosis/DiagnosisOutcome';
import { useDiagnosis } from '../features/diagnosis/useDiagnosis';
import { DiagnosticSelection } from '../features/selection/DiagnosticSelection';
import { useDiagnosticSelection } from '../features/selection/useDiagnosticSelection';
import styles from './DiagnosticsPage.module.css';

/** Основная страница механика: выбор машины и проверки, затем запрос результата диагностики. */
export function DiagnosticsPage() {
  const { vehicle, session, selectVehicle, selectSession } = useDiagnosticSelection(vehicles);
  const { diagnosis, requestDiagnosis } = useDiagnosis(
    vehicle !== null && session !== null
      ? { vehicle_id: vehicle.vehicle_id, session_id: session.session_id }
      : null,
  );
  const hintId = useId();

  const isLoading = diagnosis.status === 'loading';

  // Подсказка объясняет, почему кнопка неактивна.
  let hint: string | null = null;
  if (vehicle === null) {
    hint = 'Выберите машину и проверку.';
  } else if (session === null) {
    hint = 'Выберите проверку.';
  }

  return (
    <>
      <h1 className={styles.title}>Диагностика двигателя</h1>

      <DiagnosticSelection
        vehicles={vehicles}
        vehicle={vehicle}
        session={session}
        onSelectVehicle={selectVehicle}
        onSelectSession={selectSession}
      />

      <div className={styles.action}>
        <Button
          variant="primary"
          disabled={hint !== null}
          isBusy={isLoading}
          aria-describedby={hint !== null ? hintId : undefined}
          onClick={requestDiagnosis}
        >
          {isLoading ? 'Запрашиваем результат…' : 'Получить результат диагностики'}
        </Button>
        {hint !== null && (
          <p id={hintId} className={styles.hint}>
            {hint}
          </p>
        )}
      </div>

      <DiagnosisOutcome diagnosis={diagnosis} />
    </>
  );
}
