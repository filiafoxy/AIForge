import { useEffect, useId, useRef } from 'react';
import { Button } from '../../components/Button';
import type { Session, Vehicle } from '../../types/fleet';
import { formatDateTime } from '../../utils/formatDateTime';
import { MessageComposer } from './MessageComposer';
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
  const { messages, isDiagnosisPending, isAgentPending, requestDiagnosis, sendQuestion, startTicket, closeTicket } =
    useConversation(vehicle, session);
  const headingId = useId();
  const hintId = useId();
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const lastMessage = messages.at(-1);
  const isPending = isDiagnosisPending || isAgentPending;

  // Новое сообщение на телефоне появляется за нижним краем экрана — подводим его в поле зрения.
  // После своей реплики механику нужно поле ввода. После ответа — ответ вместе с полем ввода,
  // если они помещаются на экран. Длинный ответ показываем сам по себе: браузер выравнивает
  // его по началу, так что читать можно с первой строки.
  useEffect(() => {
    const message = lastMessageRef.current;
    const composer = composerRef.current;
    if (lastMessage === undefined || message === null || composer === null) return;

    const fitsWithComposer =
      composer.getBoundingClientRect().bottom - message.getBoundingClientRect().top <= window.innerHeight;
    if (lastMessage.kind === 'user' || fitsWithComposer) composer.scrollIntoView({ block: 'nearest' });
    if (lastMessage.kind !== 'user') message.scrollIntoView({ block: 'nearest' });
  }, [lastMessage]);

  // Пока ждём ответ, держим на виду конец ленты с пометкой об ожидании и поле ввода.
  useEffect(() => {
    if (isPending) composerRef.current?.scrollIntoView({ block: 'nearest' });
  }, [isPending]);

  // Подсказка объясняет, почему кнопка неактивна.
  let hint: string | null = null;
  if (vehicle === null) {
    hint = 'Выберите машину и проверку.';
  } else if (session === null) {
    hint = 'Выберите проверку.';
  }

  const pendingNotes: string[] = [];
  if (isDiagnosisPending) pendingNotes.push('Запрашиваем результат диагностики…');
  if (isAgentPending) pendingNotes.push('Помощник отвечает…');

  return (
    <>
      <div className={styles.action}>
        <Button
          variant="primary"
          disabled={hint !== null}
          isBusy={isDiagnosisPending}
          aria-describedby={hint !== null ? hintId : undefined}
          onClick={requestDiagnosis}
        >
          {isDiagnosisPending ? 'Запрашиваем результат…' : 'Получить результат диагностики'}
        </Button>
        {hint !== null && (
          <p id={hintId} className={styles.hint}>
            {hint}
          </p>
        )}
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
            {messages.length === 0 && !isPending && (
              <p className={styles.empty}>
                Сообщений пока нет. Получите результат диагностики или задайте вопрос помощнику.
              </p>
            )}
            <MessageFeed
              messages={messages}
              pendingNotes={pendingNotes}
              vehicle={vehicle}
              session={session}
              lastMessageRef={lastMessageRef}
              onStartTicket={startTicket}
              onCloseTicket={closeTicket}
            />
            <div ref={composerRef} className={styles.composer}>
              <MessageComposer isSending={isAgentPending} onSend={sendQuestion} />
            </div>
          </>
        ) : (
          <p className={styles.empty}>Здесь появятся результат диагностики и ответы помощника.</p>
        )}
      </section>
    </>
  );
}
