import { Panel } from '../../components/Panel';
import { formatDateTime } from '../../utils/formatDateTime';
import { useTicketHistory } from './ticketHistoryStore';
import styles from './TicketHistory.module.css';

/** Список заявок, созданных в этом браузере (FR-12): номер, машина, проверка, дата. Новые — сверху. */
export function TicketHistory() {
  const history = useTicketHistory();

  return (
    <Panel title="История заявок">
      {history.length === 0 ? (
        <p className={styles.note}>Заявок пока нет. Здесь появятся номера заявок, созданных в этом браузере.</p>
      ) : (
        <>
          <ul className={styles.list}>
            {history.map((entry) => (
              <li key={`${entry.ticket_id}/${entry.created_at}`} className={styles.item}>
                <span className={styles.ticketId}>{entry.ticket_id}</span>
                <span className={styles.details}>
                  {entry.vehicle_id} · проверка {entry.session_id} ·{' '}
                  <time dateTime={entry.created_at}>{formatDateTime(entry.created_at)}</time>
                </span>
              </li>
            ))}
          </ul>
          <p className={styles.note}>История хранится только в этом браузере: система ТОиР список заявок не отдаёт.</p>
        </>
      )}
    </Panel>
  );
}
