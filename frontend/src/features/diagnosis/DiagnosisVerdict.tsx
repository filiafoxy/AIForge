import { useId } from 'react';
import { Notice } from '../../components/Notice';
import type { DiagnoseResponse } from '../../types/diagnosis';
import type { Session, Vehicle } from '../../types/fleet';
import { formatDateTime } from '../../utils/formatDateTime';
import { buildVerdict } from './verdict';
import styles from './DiagnosisVerdict.module.css';

interface DiagnosisVerdictProps {
  result: DiagnoseResponse;
  vehicle: Vehicle;
  session: Session;
}

/**
 * Вердикт по проверке: что получилось, насколько этому можно верить и что делать дальше.
 * Цвет и заголовок зависят от вида вердикта; сами выводы строит `buildVerdict`.
 *
 * Показывается сообщением в ленте диалога, поэтому заголовки начинаются с третьего уровня,
 * а предупреждение внутри не объявляется отдельно: лента сама сообщает о новых сообщениях.
 */
export function DiagnosisVerdict({ result, vehicle, session }: DiagnosisVerdictProps) {
  const verdict = buildVerdict(result, vehicle);
  const headingId = useId();

  return (
    <section className={`${styles.verdict} ${styles[verdict.kind]}`} aria-labelledby={headingId}>
      <header className={styles.head}>
        <p className={styles.label}>{verdict.label}</p>
        <h3 id={headingId} className={styles.title}>
          {verdict.title}
        </h3>
        <p className={styles.context}>
          {vehicle.vehicle_id} · проверка от {formatDateTime(session.checked_at)}
        </p>
        {verdict.summary.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </header>

      {verdict.caution !== null && (
        <Notice tone="warning" title="Качество записи снижено" quiet>
          <p>{verdict.caution}</p>
        </Notice>
      )}

      {verdict.sections.map((section) => (
        <div key={section.heading} className={styles.section}>
          <h4 className={styles.sectionTitle}>{section.heading}</h4>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.serviceText !== undefined && (
            <figure className={styles.quote}>
              <figcaption className={styles.quoteSource}>Описание от сервиса диагностики</figcaption>
              {/* Внешний текст выводится только как текст: React экранирует его, разметка из него не исполняется. */}
              <blockquote className={styles.quoteText}>{section.serviceText}</blockquote>
            </figure>
          )}
        </div>
      ))}

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Показатели проверки</h4>
        <dl className={styles.facts}>
          {verdict.facts.map(({ label, value }) => (
            <div key={label} className={styles.fact}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {verdict.factsNotes.map((note) => (
          <p key={note} className={styles.factsNote}>
            {note}
          </p>
        ))}
      </div>
    </section>
  );
}
