import { useEffect, useId, useRef, useState } from 'react';
import { ApiError } from '../../api/http';
import { createTicket } from '../../api/toirClient';
import { Button } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { getManualsForEngine } from '../../config/manuals';
import type { DiagnoseResponse } from '../../types/diagnosis';
import type { Session, Vehicle } from '../../types/fleet';
import type { TicketRequest } from '../../types/ticket';
import { formatDateTime } from '../../utils/formatDateTime';
import { getSuspectedFault } from '../diagnosis/verdict';
import { assessPriority } from './priority';
import { TicketForm } from './TicketForm';
import { TicketReview } from './TicketReview';
import { buildInitialDraft, NO_DRAFT_ERRORS, validateDraft } from './ticketDraft';
import { describeTicketError } from './ticketErrorMessage';
import { addTicketToHistory, useTicketHistory } from './ticketHistoryStore';
import styles from './TicketCard.module.css';

interface TicketCardProps {
  /** Результат диагностики, по которому оформляется заявка. */
  diagnosis: DiagnoseResponse;
  vehicle: Vehicle;
  session: Session;
  /** Оформление закончено: заявка создана или механик от неё отказался. */
  onClosed: (outcome: 'created' | 'cancelled') => void;
}

/**
 * Шаги оформления:
 * - `edit` — механик правит заявку;
 * - `review` — предпросмотр: состав зафиксирован, в ТОиР уйдёт именно он;
 * - `created` — ТОиР вернул номер заявки;
 * - `cancelled` — механик отказался, ничего не отправлено.
 */
type Stage =
  | { kind: 'edit' }
  | { kind: 'review'; request: TicketRequest; isSending: boolean; failure: string | null }
  | { kind: 'created'; request: TicketRequest; ticketId: string; isSavedToHistory: boolean }
  | { kind: 'cancelled' };

/**
 * Заявка на дефектовку в ленте диалога: заполнение, предпросмотр и отправка в ТОиР (FR-07 — FR-09).
 * Запрос в ТОиР уходит только по кнопке подтверждения на шаге предпросмотра.
 */
export function TicketCard({ diagnosis, vehicle, session, onClosed }: TicketCardProps) {
  const manuals = getManualsForEngine(vehicle.engine_model);
  const assessment = assessPriority(diagnosis);
  const faultTitle = getSuspectedFault(diagnosis);

  const [draft, setDraft] = useState(() =>
    buildInitialDraft(diagnosis, vehicle, session, assessment.urgency, manuals),
  );
  const [stage, setStage] = useState<Stage>({ kind: 'edit' });
  // Замечания к форме показываются после первой попытки перейти к предпросмотру и дальше следуют за правками.
  const [areErrorsShown, setAreErrorsShown] = useState(false);
  const [focusErrorSignal, setFocusErrorSignal] = useState(0);

  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Карточку открывает и ведёт по шагам сам механик, а кнопка, которую он нажал, с экрана пропадает.
  // Поэтому фокус переходит на заголовок шага: с клавиатуры и экранным диктором работа продолжается отсюда.
  useEffect(() => {
    titleRef.current?.focus();
  }, [stage.kind]);

  const earlierTickets = useTicketHistory().filter(
    (entry) =>
      entry.vehicle_id === diagnosis.vehicle_id &&
      entry.session_id === diagnosis.session_id &&
      (stage.kind !== 'created' || entry.ticket_id !== stage.ticketId),
  );

  const validation = validateDraft(draft, diagnosis, manuals);
  const errors = areErrorsShown && !validation.isValid ? validation.errors : NO_DRAFT_ERRORS;

  function goToReview() {
    if (validation.isValid) {
      setStage({ kind: 'review', request: validation.request, isSending: false, failure: null });
    } else {
      setAreErrorsShown(true);
      setFocusErrorSignal((signal) => signal + 1);
    }
  }

  function cancel() {
    setStage({ kind: 'cancelled' });
    onClosed('cancelled');
  }

  function confirm() {
    if (stage.kind !== 'review' || stage.isSending) return;
    const { request } = stage;
    setStage({ kind: 'review', request, isSending: true, failure: null });

    // Запрос не отменяется, даже если механик уйдёт с этой проверки: заявка в ТОиР уже могла
    // появиться, и её номер должен попасть в историю.
    createTicket(request).then(
      (response) => {
        const isSavedToHistory = addTicketToHistory({
          ticket_id: response.ticket_id,
          vehicle_id: request.vehicle_id,
          session_id: request.session_id,
          created_at: new Date().toISOString(),
        });
        setStage({ kind: 'created', request, ticketId: response.ticket_id, isSavedToHistory });
        onClosed('created');
      },
      (cause: unknown) => {
        const error = cause instanceof ApiError ? cause : new ApiError('unknown', { cause });
        console.error('Заявка не создана:', error, error.serviceDetail ?? '');
        setStage({ kind: 'review', request, isSending: false, failure: describeTicketError(error, request) });
      },
    );
  }

  let title: string;
  switch (stage.kind) {
    case 'edit':
      title = 'Заполните заявку';
      break;
    case 'review':
      title = 'Проверьте заявку перед отправкой';
      break;
    case 'created':
      title = `Заявка ${stage.ticketId} создана`;
      break;
    case 'cancelled':
      title = 'Заявка отменена';
      break;
  }

  return (
    <section className={`${styles.card} ${styles[stage.kind]}`} aria-labelledby={titleId}>
      <header className={styles.head}>
        <p className={styles.kicker}>Заявка на дефектовку</p>
        <h3 id={titleId} ref={titleRef} tabIndex={-1} className={styles.title}>
          {title}
        </h3>
        <p className={styles.context}>
          {vehicle.vehicle_id} · проверка {session.session_id} от {formatDateTime(session.checked_at)}
        </p>
      </header>

      {(stage.kind === 'edit' || stage.kind === 'review') && earlierTickets.length > 0 && (
        <Notice tone="warning" title="По этой проверке уже есть заявка" quiet>
          <p>
            {earlierTickets
              .map((entry) => `${entry.ticket_id} от ${formatDateTime(entry.created_at)}`)
              .join('; ')}
            . Новая заявка будет отдельной.
          </p>
        </Notice>
      )}

      {stage.kind === 'edit' && manuals.length === 0 && (
        <Notice tone="error" title="Нет списка руководств" quiet>
          <p>
            Для двигателя {vehicle.engine_model} в приложении нет руководств, поэтому указать источник и отправить
            заявку не получится.
          </p>
        </Notice>
      )}

      {stage.kind === 'edit' && (
        <TicketForm
          draft={draft}
          errors={errors}
          manuals={manuals}
          assessment={assessment}
          focusErrorSignal={focusErrorSignal}
          onChange={setDraft}
          onSubmit={goToReview}
          onCancel={cancel}
        />
      )}

      {stage.kind === 'review' && (
        <>
          <p>В ТОиР уйдёт заявка в этом составе. Пока вы её не подтвердили, ничего не отправлено.</p>
          <TicketReview
            request={stage.request}
            vehicle={vehicle}
            session={session}
            faultTitle={faultTitle}
            assessment={assessment}
          />
          {stage.failure !== null && (
            <Notice tone="error" title="Заявка не отправлена" quiet>
              <p>{stage.failure}</p>
            </Notice>
          )}
          <div className={styles.actions}>
            <Button variant="primary" isBusy={stage.isSending} onClick={confirm}>
              {stage.isSending ? 'Отправляем заявку…' : 'Подтвердить и отправить в ТОиР'}
            </Button>
            <Button disabled={stage.isSending} onClick={() => setStage({ kind: 'edit' })}>
              Изменить
            </Button>
            <Button disabled={stage.isSending} onClick={cancel}>
              Отменить заявку
            </Button>
          </div>
        </>
      )}

      {stage.kind === 'created' && (
        <>
          <p>
            Система ТОиР приняла заявку и присвоила ей номер <strong>{stage.ticketId}</strong>.{' '}
            {stage.isSavedToHistory && 'Заявка записана в историю заявок в этом браузере.'}
          </p>
          {!stage.isSavedToHistory && (
            <Notice tone="warning" title="Заявка не записана в историю" quiet>
              <p>
                Браузер не дал сохранить историю заявок. Запишите номер {stage.ticketId}: после перезагрузки
                страницы он пропадёт.
              </p>
            </Notice>
          )}
          <TicketReview
            request={stage.request}
            vehicle={vehicle}
            session={session}
            faultTitle={faultTitle}
            assessment={assessment}
          />
        </>
      )}

      {stage.kind === 'cancelled' && (
        <p>
          В ТОиР ничего не отправлено. Чтобы начать заново, нажмите «Оформить заявку на дефектовку» под
          результатом диагностики.
        </p>
      )}
    </section>
  );
}
