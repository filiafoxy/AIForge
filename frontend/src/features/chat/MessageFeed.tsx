import type { ReactNode, Ref } from 'react';
import { Notice } from '../../components/Notice';
import type { Session, Vehicle } from '../../types/fleet';
import { DiagnosisVerdict } from '../diagnosis/DiagnosisVerdict';
import type { ChatMessage } from './conversationState';
import styles from './MessageFeed.module.css';

interface MessageFeedProps {
  messages: readonly ChatMessage[];
  /** Что сейчас выполняется: по строке на каждый запрос, ответа на который ещё нет. */
  pendingNotes: readonly string[];
  /** Машина и проверка, к которым относится диалог: нужны вердикту. */
  vehicle: Vehicle;
  session: Session;
  /** Ссылка на последнее сообщение ленты — чтобы подвести его в поле зрения. */
  lastMessageRef: Ref<HTMLDivElement>;
}

/**
 * Лента диалога. Размечена как журнал: экранный диктор сам зачитывает новые сообщения,
 * поэтому фокус при их появлении никуда не переводится.
 */
export function MessageFeed({ messages, pendingNotes, vehicle, session, lastMessageRef }: MessageFeedProps) {
  return (
    <div className={styles.feed} role="log" aria-label="Сообщения диалога">
      {messages.map((message, index) => (
        <div
          key={message.id}
          ref={index === messages.length - 1 ? lastMessageRef : undefined}
          className={message.kind === 'user' ? `${styles.message} ${styles.fromUser}` : styles.message}
        >
          {renderMessage(message, vehicle, session)}
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

function renderMessage(message: ChatMessage, vehicle: Vehicle, session: Session): ReactNode {
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
