import { useEffect, useId, useRef } from 'react';
import { Button } from '../../components/Button';
import type { Session, Vehicle } from '../../types/fleet';
import { formatDateTime } from '../../utils/formatDateTime';
import { DiagnosisRules } from '../diagnosis/DiagnosisRules';
import { MessageComposer } from './MessageComposer';
import { hasOpenTicket } from './conversationState';
import { MessageFeed } from './MessageFeed';
import { useConversation } from './useConversation';
import styles from './Conversation.module.css';

interface ConversationProps {
  vehicle: Vehicle | null;
  session: Session | null;
}

/**
 * Диалог механика с помощником по выбранной проверке: кнопка диагностики, лента и поле ввода.
 *
 * Диалог привязан к паре «машина — проверка». При смене выбора он начинается заново:
 * ответы по одному двигателю не должны оставаться на экране, когда выбрана другая машина.
 */
export function Conversation({ vehicle, session }: ConversationProps) {
  const conversationKey = vehicle !== null && session !== null ? `${vehicle.vehicle_id}/${session.session_id}` : '';
  return <ConversationForSelection key={conversationKey} vehicle={vehicle} session={session} />;
}

function ConversationForSelection({ vehicle, session }: ConversationProps) {
  const {
    messages,
    isDiagnosisPending,
    isAgentPending,
    isAnalysisPending,
    requestDiagnosis,
    requestAnalysis,
    sendQuestion,
    diagnosis,
    startTicket,
    closeTicket,
  } = useConversation(vehicle, session);
  const headingId = useId();
  const hintId = useId();
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const lastMessage = messages.at(-1);
  // По кнопке диагностики приложение сначала получает результат у ML-сервиса, затем заключение у помощника.
  // Для механика это одно ожидание.
  const isConclusionPending = isDiagnosisPending || isAnalysisPending;
  // Механик сам запросил и ждёт: заключение по диагностике или ответ на свой вопрос.
  const isAwaitingReply = isConclusionPending || isAgentPending;
  // Форма заявки открыта: механик работает в ней, и экран из-под рук уводить нельзя.
  const isFillingTicket = hasOpenTicket(messages);

  // Новое сообщение на телефоне появляется за нижним краем экрана — подводим его в поле зрения.
  // После своей реплики механику нужно поле ввода. После ответа — ответ вместе с полем ввода,
  // если они помещаются на экран. Длинный ответ показываем сам по себе: браузер выравнивает
  // его по началу, так что читать можно с первой строки.
  useEffect(() => {
    const message = lastMessageRef.current;
    const composer = composerRef.current;
    if (lastMessage === undefined || message === null || composer === null) return;
    // Ответ помощника, пришедший во время заполнения заявки, ждёт внизу ленты.
    if (isFillingTicket && lastMessage.kind !== 'ticket') return;

    const fitsWithComposer =
      composer.getBoundingClientRect().bottom - message.getBoundingClientRect().top <= window.innerHeight;
    if (lastMessage.kind === 'user' || fitsWithComposer) composer.scrollIntoView({ block: 'nearest' });
    if (lastMessage.kind !== 'user') message.scrollIntoView({ block: 'nearest' });
    // В зависимостях только сообщение: прокрутку вызывает его появление, а не открытие или закрытие заявки.
  }, [lastMessage]);

  // Пока ждём ответ, держим на виду конец ленты с пометкой об ожидании и поле ввода.
  useEffect(() => {
    if (isAwaitingReply) composerRef.current?.scrollIntoView({ block: 'nearest' });
  }, [isAwaitingReply]);

  // Подсказка объясняет, почему кнопка неактивна.
  let hint: string | null = null;
  if (vehicle === null) {
    hint = 'Выберите машину и проверку.';
  } else if (session === null) {
    hint = 'Выберите проверку.';
  } else if (isAgentPending) {
    hint = 'Помощник отвечает на вопрос. Дождитесь ответа.';
  }

  const pendingNotes: string[] = [];
  if (isDiagnosisPending) pendingNotes.push('Запрашиваем результат диагностики…');
  if (isAnalysisPending) {
    pendingNotes.push('Помощник готовит заключение по результату диагностики. Это может занять несколько минут…');
  }
  if (isAgentPending) pendingNotes.push('Помощник отвечает…');

  return (
    <>
      <div className={styles.action}>
        <Button
          variant="primary"
          disabled={hint !== null}
          isBusy={isConclusionPending}
          aria-describedby={hint !== null ? hintId : undefined}
          onClick={requestDiagnosis}
        >
          {isConclusionPending ? 'Готовим результат…' : 'Получить результат диагностики'}
        </Button>
        {hint !== null && (
          <p id={hintId} className={styles.hint}>
            {hint}
          </p>
        )}
        <DiagnosisRules />
      </div>

      <section className={styles.chat} aria-labelledby={headingId}>
        <div className={styles.chatHead}>
          <h2 id={headingId} className={styles.chatTitle}>
            Диалог с помощником
          </h2>
          {vehicle !== null && session !== null && (
            <p className={styles.context}>
              {vehicle.vehicle_id} · {vehicle.engine_model} · проверка от {formatDateTime(session.checked_at)}
            </p>
          )}
        </div>

        {vehicle !== null && session !== null ? (
          <>
            {messages.length === 0 && !isAwaitingReply && (
              <p className={styles.empty}>
                Сообщений пока нет. Получите результат диагностики или задайте вопрос помощнику.
              </p>
            )}
            <MessageFeed
              messages={messages}
              pendingNotes={pendingNotes}
              vehicle={vehicle}
              session={session}
              diagnosis={diagnosis}
              isAnalysisPending={isAnalysisPending}
              isAnswerPending={isAgentPending}
              lastMessageRef={lastMessageRef}
              onStartTicket={startTicket}
              onCloseTicket={closeTicket}
              onRequestAnalysis={requestAnalysis}
            />
            <div ref={composerRef} className={styles.composer}>
              <MessageComposer isSending={isAwaitingReply} onSend={sendQuestion} />
            </div>
          </>
        ) : (
          <p className={styles.empty}>Здесь появятся результат диагностики и ответы помощника.</p>
        )}
      </section>
    </>
  );
}
