import type { ReactNode, Ref } from 'react';
import { Button } from '../../components/Button';
import { Notice } from '../../components/Notice';
import type { DiagnoseResponse } from '../../types/diagnosis';
import type { Session, Vehicle } from '../../types/fleet';
import { TicketCard } from '../tickets/TicketCard';
import { canRequestTicket } from '../tickets/ticketDraft';
import { AgentMarkdown } from './AgentMarkdown';
import { findLatestDraft, findOpenTicket, findTicketAnchor } from './conversationState';
import type { ChatMessage } from './conversationState';
import styles from './MessageFeed.module.css';

interface MessageFeedProps {
  messages: readonly ChatMessage[];
  /** Что сейчас выполняется: по строке на каждый запрос, ответа на который ещё нет. */
  pendingNotes: readonly string[];
  /** Машина и проверка, к которым относится диалог: нужны заявке. */
  vehicle: Vehicle;
  session: Session;
  /** Помощник готовит заключение по результату диагностики. */
  isAnalysisPending: boolean;
  /** Помощник отвечает на вопрос механика: заключение в это время запросить нельзя. */
  isAnswerPending: boolean;
  /** Ссылка на последнее сообщение ленты — чтобы подвести его в поле зрения. */
  lastMessageRef: Ref<HTMLDivElement>;
  onStartTicket: (diagnosis: DiagnoseResponse) => void;
  onCloseTicket: (messageId: number, status: 'created' | 'cancelled') => void;
  onRequestAnalysis: (diagnosis: DiagnoseResponse) => void;
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
  isAnalysisPending,
  isAnswerPending,
  lastMessageRef,
  onStartTicket,
  onCloseTicket,
  onRequestAnalysis,
}: MessageFeedProps) {
  const openTicket = findOpenTicket(messages);
  const hasDraft = findLatestDraft(messages) !== null;

  const ticketAnchor = findTicketAnchor(messages);

  /**
   * Кнопка заявки под заключением помощника. Подсказка объясняет, чем заполнится форма.
   * Предлагать ли заявку, решает не текст помощника, а результат ML-сервиса: только
   * по достоверному отклонению. В остальных случаях диагноза нет.
   */
  function renderTicketAction(message: ChatMessage): ReactNode {
    if (ticketAnchor === null || ticketAnchor.id !== message.id) return null;
    const { diagnosis } = ticketAnchor;
    if (!canRequestTicket(diagnosis)) return null;

    let hint: string | null = null;
    if (openTicket !== null) {
      // Черновик пришёл позже, чем открыли форму: сама она уже не изменится.
      hint =
        hasDraft && openTicket.suggestion === null
          ? 'Заявка уже оформляется в этом диалоге. Чтобы заполнить её по черновику помощника, отмените её и оформите заново.'
          : 'Заявка уже оформляется в этом диалоге.';
    } else if (hasDraft) {
      hint = 'Форма заполнится по черновику помощника. Проверьте его перед отправкой.';
    }

    return (
      <div className={styles.followUp}>
        <Button disabled={openTicket !== null} onClick={() => onStartTicket(diagnosis)}>
          Оформить заявку на дефектовку
        </Button>
        {hint !== null && <p className={styles.pending}>{hint}</p>}
      </div>
    );
  }

  /** Последнее ли это сообщение о заключении по своему результату: только под ним уместен повтор запроса. */
  function isLatestAnalysisMessage(message: ChatMessage, diagnosis: DiagnoseResponse): boolean {
    return !messages.some(
      (later) =>
        later.id > message.id &&
        (later.kind === 'assistant' || later.kind === 'error') &&
        later.analysisOf === diagnosis,
    );
  }

  function renderMessage(message: ChatMessage): ReactNode {
    switch (message.kind) {
      case 'user':
        return (
          <>
            <p className={styles.author}>Вы</p>
            {/* Текст механика выводится как есть, без разбора разметки. */}
            <p className={styles.bubble}>{message.text}</p>
          </>
        );
      case 'assistant':
        return (
          <>
            <p className={styles.author}>Помощник</p>
            {/* Рассуждения модели свёрнуты: механику нужен ответ, а ход мысли — по желанию. */}
            {message.thinking !== null && (
              <details className={styles.thinking}>
                <summary>Размышление помощника</summary>
                <p className={styles.thinkingNote}>Черновые рассуждения модели. Ответ помощника — ниже.</p>
                <p className={styles.thinkingText}>{message.thinking}</p>
              </details>
            )}
            <div className={`${styles.bubble} ${styles.rich}`}>
              <AgentMarkdown text={message.text} />
            </div>
            {renderTicketAction(message)}
          </>
        );
      case 'ticket':
        return (
          <>
            <p className={styles.author}>Помощник</p>
            <TicketCard
              diagnosis={message.diagnosis}
              suggestion={message.suggestion}
              vehicle={vehicle}
              session={session}
              onClosed={(outcome) => onCloseTicket(message.id, outcome)}
            />
          </>
        );
      case 'error': {
        const { analysisOf } = message;
        return (
          <>
            <Notice tone="error" title={message.title} quiet>
              <p>{message.text}</p>
            </Notice>
            {analysisOf !== null && isLatestAnalysisMessage(message, analysisOf) && (
              <div className={styles.followUp}>
                <Button
                  disabled={isAnswerPending}
                  isBusy={isAnalysisPending}
                  onClick={() => onRequestAnalysis(analysisOf)}
                >
                  {isAnalysisPending ? 'Запрашиваем заключение…' : 'Запросить заключение ещё раз'}
                </Button>
              </div>
            )}
          </>
        );
      }
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
