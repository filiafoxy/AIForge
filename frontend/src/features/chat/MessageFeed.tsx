import type { ReactNode, Ref } from 'react';
import { Button } from '../../components/Button';
import { Notice } from '../../components/Notice';
import type { DiagnoseResponse } from '../../types/diagnosis';
import type { Session, Vehicle } from '../../types/fleet';
import { DiagnosisVerdict } from '../diagnosis/DiagnosisVerdict';
import { TicketCard } from '../tickets/TicketCard';
import { canRequestTicket } from '../tickets/ticketDraft';
import { hasOpenTicket } from './conversationState';
import type { ChatMessage } from './conversationState';
import styles from './MessageFeed.module.css';

interface MessageFeedProps {
  messages: readonly ChatMessage[];
  /** Что сейчас выполняется: по строке на каждый запрос, ответа на который ещё нет. */
  pendingNotes: readonly string[];
  /** Машина и проверка, к которым относится диалог: нужны вердикту и заявке. */
  vehicle: Vehicle;
  session: Session;
  /** Ссылка на последнее сообщение ленты — чтобы подвести его в поле зрения. */
  lastMessageRef: Ref<HTMLDivElement>;
  onStartTicket: (diagnosis: DiagnoseResponse) => void;
  onCloseTicket: (messageId: number, status: 'created' | 'cancelled') => void;
}

/**
 * Лента диалога. Размечена как журнал: экранный диктор сам зачитывает новые сообщения,
 * поэтому фокус при их появлении никуда не переводится.
 */
export function MessageFeed({
  messages,
  pendingNotes,
  vehicle,
  session,
  lastMessageRef,
  onStartTicket,
  onCloseTicket,
}: MessageFeedProps) {
  const isTicketOpen = hasOpenTicket(messages);

  function renderMessage(message: ChatMessage): ReactNode {
    switch (message.kind) {
      case 'user':
        return (
          <>
            <p className={styles.author}>Вы</p>
            {/* Текст выводится как есть, без разбора разметки. */}
            <p className={styles.bubble}>{message.text}</p>
          </>
        );
      case 'assistant':
        return (
          <>
            <p className={styles.author}>Помощник</p>
            <p className={styles.bubble}>{message.text}</p>
          </>
        );
      case 'verdict':
        return (
          <>
            <p className={styles.author}>Помощник</p>
            <DiagnosisVerdict result={message.result} vehicle={vehicle} session={session} />
            {/* Заявка предлагается только по достоверному отклонению: в остальных случаях диагноза нет. */}
            {canRequestTicket(message.result) && (
              <div className={styles.followUp}>
                <Button disabled={isTicketOpen} onClick={() => onStartTicket(message.result)}>
                  Оформить заявку на дефектовку
                </Button>
                {isTicketOpen && <p className={styles.pending}>Заявка уже оформляется ниже в диалоге.</p>}
              </div>
            )}
          </>
        );
      case 'ticket':
        return (
          <>
            <p className={styles.author}>Помощник</p>
            <TicketCard
              diagnosis={message.diagnosis}
              vehicle={vehicle}
              session={session}
              onClosed={(outcome) => onCloseTicket(message.id, outcome)}
            />
          </>
        );
      case 'error':
        return (
          <Notice tone="error" title={message.title} quiet>
            <p>{message.text}</p>
          </Notice>
        );
    }
  }

  return (
    <div className={styles.feed} role="log" aria-label="Сообщения диалога">
      {messages.map((message, index) => (
        <div
          key={message.id}
          ref={index === messages.length - 1 ? lastMessageRef : undefined}
          className={message.kind === 'user' ? `${styles.message} ${styles.fromUser}` : styles.message}
        >
          {renderMessage(message)}
        </div>
      ))}
      {pendingNotes.map((note) => (
        <p key={note} className={styles.pending}>
          {note}
        </p>
      ))}
    </div>
  );
}
