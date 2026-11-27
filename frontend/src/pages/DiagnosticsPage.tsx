import { vehicles } from '../data/fleet';
import { Conversation } from '../features/chat/Conversation';
import { DiagnosticSelection } from '../features/selection/DiagnosticSelection';
import { useDiagnosticSelection } from '../features/selection/useDiagnosticSelection';
import { TicketHistory } from '../features/tickets/TicketHistory';
import styles from './DiagnosticsPage.module.css';

/** Основная страница механика: выбор машины и проверки, затем диалог по этой проверке. */
export function DiagnosticsPage() {
  const { vehicle, session, selectVehicle, selectSession } = useDiagnosticSelection(vehicles);

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

      <Conversation vehicle={vehicle} session={session} />

      <TicketHistory />
    </>
  );
}
