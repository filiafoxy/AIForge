import type { Session, Vehicle } from '../../types/fleet';
import type { TicketRequest } from '../../types/ticket';
import { formatDateTime } from '../../utils/formatDateTime';
import { PriorityReasons } from './PriorityReasons';
import { URGENCY_TEXT } from './priority';
import type { PriorityAssessment } from './priority';
import styles from './TicketCard.module.css';

interface TicketReviewProps {
  /** Заявка ровно в том виде, в каком она уйдёт в ТОиР. */
  request: TicketRequest;
  vehicle: Vehicle;
  session: Session;
  /** Название группы неисправностей: механику показывается оно, а не код из заявки. */
  faultTitle: string | null;
  assessment: PriorityAssessment;
}

/** Состав заявки только для чтения: что именно механик подтверждает (FR-09). */
export function TicketReview({ request, vehicle, session, faultTitle, assessment }: TicketReviewProps) {
  return (
    <dl className={styles.composition}>
      <div className={styles.item}>
        <dt>Машина</dt>
        <dd>
          {vehicle.vehicle_id} · {vehicle.engine_model}
        </dd>
      </div>
      <div className={styles.item}>
        <dt>Проверка</dt>
        <dd>
          {session.session_id} от {formatDateTime(session.checked_at)}
        </dd>
      </div>
      <div className={styles.item}>
        <dt>Группа неисправностей</dt>
        <dd>{faultTitle ?? 'не указана'}</dd>
      </div>
      <div className={styles.item}>
        <dt>Заключение</dt>
        <dd className={styles.preserve}>{request.conclusion}</dd>
      </div>
      <div className={styles.item}>
        <dt>Приоритет</dt>
        <dd className={styles.stack}>
          <span className={styles.urgency}>{URGENCY_TEXT[request.urgency]}</span>
          <PriorityReasons urgency={request.urgency} assessment={assessment} />
        </dd>
      </div>
      <div className={styles.item}>
        <dt>Работы</dt>
        <dd>
          <ul className={styles.list}>
            {request.operations.map((operation, index) => (
              <li key={index}>{operation}</li>
            ))}
          </ul>
        </dd>
      </div>
      <div className={styles.item}>
        <dt>Запчасти</dt>
        <dd>
          {request.spare_parts.length > 0 ? (
            <ul className={styles.list}>
              {request.spare_parts.map((part, index) => (
                <li key={index}>{part}</li>
              ))}
            </ul>
          ) : (
            'не указаны'
          )}
        </dd>
      </div>
      <div className={styles.item}>
        <dt>Источники</dt>
        <dd>
          <ul className={styles.list}>
            {request.references.map((reference) => (
              <li key={`${reference.manual}/${reference.pdf_page}`}>
                {reference.manual}, страница {reference.pdf_page}
              </li>
            ))}
          </ul>
        </dd>
      </div>
    </dl>
  );
}
