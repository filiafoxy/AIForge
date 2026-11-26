import { useEffect, useRef } from 'react';
import { Notice } from '../../components/Notice';
import { Panel } from '../../components/Panel';
import { describeDiagnosisError } from './diagnosisErrorMessage';
import type { DiagnosisState } from './useDiagnosis';
import styles from './DiagnosisOutcome.module.css';

interface DiagnosisOutcomeProps {
  diagnosis: DiagnosisState;
}

/** Итог запроса диагностики: сообщение об ошибке или ответ сервиса. До запроса и во время него пуст. */
export function DiagnosisOutcome({ diagnosis }: DiagnosisOutcomeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // На телефоне итог появляется под кнопкой, за нижним краем экрана, — подводим его в поле зрения.
  useEffect(() => {
    containerRef.current?.scrollIntoView({ block: 'nearest' });
  }, [diagnosis]);

  if (diagnosis.status === 'error') {
    return (
      <div ref={containerRef}>
        <Notice tone="error" title="Результат диагностики не получен">
          <p>{describeDiagnosisError(diagnosis.error, diagnosis.request)}</p>
        </Notice>
      </div>
    );
  }

  if (diagnosis.status === 'success') {
    // Временно, до CP-3: сырой ответ сервиса для отладки. Его заменит понятный механику вердикт.
    return (
      <div ref={containerRef}>
        <Panel title="Ответ сервиса диагностики">
          <p className={styles.note}>Необработанный ответ — на следующем шаге его заменит вердикт.</p>
          <pre className={styles.raw}>{JSON.stringify(diagnosis.result, null, 2)}</pre>
        </Panel>
      </div>
    );
  }

  return null;
}
