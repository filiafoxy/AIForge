import { useId } from 'react';
import type { Session } from '../../types/fleet';
import { formatDateTime } from '../../utils/formatDateTime';
import styles from './SessionPicker.module.css';

interface SessionPickerProps {
  /** Госномер машины, чьи проверки показаны, — для подписи группы. */
  vehicleId: string;
  sessions: readonly Session[];
  selectedSessionId: string | null;
  onSelect: (sessionId: string) => void;
}

function sortNewestFirst(sessions: readonly Session[]): Session[] {
  return [...sessions].sort((a, b) => Date.parse(b.checked_at) - Date.parse(a.checked_at));
}

/** История проверок одной машины: выбор одной проверки, свежие сверху. */
export function SessionPicker({ vehicleId, sessions, selectedSessionId, onSelect }: SessionPickerProps) {
  const groupName = useId();

  return (
    <fieldset className={styles.group}>
      <legend className="visually-hidden">Проверки машины {vehicleId}</legend>
      {sortNewestFirst(sessions).map((session) => (
        <label key={session.session_id} className={styles.option}>
          <input
            type="radio"
            className={styles.radio}
            name={groupName}
            value={session.session_id}
            checked={session.session_id === selectedSessionId}
            onChange={() => onSelect(session.session_id)}
          />
          <span className={styles.text}>
            <span className={styles.sessionId}>{session.session_id}</span>
            <time className={styles.date} dateTime={session.checked_at}>
              {formatDateTime(session.checked_at)}
            </time>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
