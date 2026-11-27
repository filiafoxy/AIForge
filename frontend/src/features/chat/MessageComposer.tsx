import { useEffect, useId, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { Button } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { describeRejection, ImageRejectedError, MAX_IMAGES, prepareImage } from './imageAttachments';
import type { ImageAttachment } from './imageAttachments';
import { useSpeechInput } from './useSpeechInput';
import type { SpeechAvailability, SpeechInputError } from './useSpeechInput';
import styles from './MessageComposer.module.css';

interface MessageComposerProps {
  /** Ждём ответ на предыдущее сообщение: новое пока отправить нельзя, но набирать можно. */
  isSending: boolean;
  /**
   * Отправляет сообщение. Изображения переходят во владение получателя: он показывает их в ленте
   * и сам освобождает их адреса `blob:`.
   */
  onSend: (text: string, images: readonly ImageAttachment[]) => void;
}

const MAX_MESSAGE_LENGTH = 2000;

const SPEECH_ERROR_TEXT: Record<SpeechInputError, string> = {
  not_allowed: 'Нет доступа к микрофону. Разрешите его для этой страницы в настройках браузера.',
  no_speech: 'Речь не расслышана. Нажмите на микрофон и повторите.',
  no_microphone: 'Микрофон не найден. Подключите его или введите текст вручную.',
  network: 'Сервис распознавания речи недоступен. Проверьте связь или введите текст вручную.',
  unknown: 'Распознать речь не удалось. Введите текст вручную.',
};

const SPEECH_UNAVAILABLE_TEXT: Record<Exclude<SpeechAvailability, 'available'>, string> = {
  unsupported: 'Голосовой ввод недоступен: этот браузер не умеет распознавать речь.',
  insecure: 'Голосовой ввод работает, только когда приложение открыто по защищённому адресу (https).',
};

/** Дописывает распознанную фразу к уже набранному тексту. */
function appendDictation(draft: string, phrase: string): string {
  const separator = draft === '' || /\s$/.test(draft) ? '' : ' ';
  return (draft + separator + phrase).slice(0, MAX_MESSAGE_LENGTH);
}

/**
 * Поле для вопроса помощнику: текст с клавиатуры или голосом, к нему — изображения.
 *
 * Распознанная речь попадает в поле, а не уходит сразу: механик видит, что получилось,
 * может поправить и отправляет сам (FR-14). Так же с изображениями: сначала они видны под полем,
 * и только по кнопке «Отправить» уходят помощнику.
 */
export function MessageComposer({ isSending, onSend }: MessageComposerProps) {
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<readonly ImageAttachment[]>([]);
  const [isPreparing, setIsPreparing] = useState(false);
  const [attachmentProblems, setAttachmentProblems] = useState<readonly string[]>([]);
  const fieldId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextAttachmentId = useRef(0);
  const isMountedRef = useRef(false);
  const attachmentsRef = useRef<readonly ImageAttachment[]>([]);
  const speech = useSpeechInput((phrase) => setDraft((current) => appendDictation(current, phrase)));

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Не отправленные изображения никому не нужны: освобождаем память под миниатюры.
      attachmentsRef.current.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl));
    };
  }, []);

  const canSend = (draft.trim() !== '' || attachments.length > 0) && !isPreparing;

  function submit() {
    if (!canSend || isSending) return;
    // Микрофон выключаем: иначе фраза, сказанная до отправки, попала бы в уже очищенное поле.
    speech.cancel();
    onSend(draft, attachments);
    setDraft('');
    setAttachments([]);
    setAttachmentProblems([]);
  }

  async function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Тот же файл можно выбрать снова, если его убрали.
    event.target.value = '';
    if (files.length === 0) return;

    const problems: string[] = [];
    const room = MAX_IMAGES - attachments.length;
    if (files.length > room) {
      problems.push(`К одному сообщению можно приложить не больше ${MAX_IMAGES} изображений.`);
    }

    setAttachmentProblems([]);
    setIsPreparing(true);
    const results = await Promise.allSettled(files.slice(0, Math.max(room, 0)).map(prepareImage));
    // Диалог могли закрыть, пока файлы сжимались: адреса не создаём — освобождать их было бы некому.
    if (!isMountedRef.current) return;

    const added: ImageAttachment[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        added.push({
          id: nextAttachmentId.current++,
          file: result.value,
          previewUrl: URL.createObjectURL(result.value),
        });
        return;
      }
      const reason = result.reason instanceof ImageRejectedError ? result.reason.reason : 'unreadable';
      problems.push(describeRejection(files[index].name, reason));
    });

    setAttachments((current) => [...current, ...added]);
    setAttachmentProblems(problems);
    setIsPreparing(false);
  }

  function removeAttachment(id: number) {
    const removed = attachments.find((attachment) => attachment.id === id);
    if (removed === undefined) return;
    URL.revokeObjectURL(removed.previewUrl);
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
    setAttachmentProblems([]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter отправляет, Shift+Enter переносит строку. Пока идёт набор через экранную
    // клавиатуру с подстановкой (IME), Enter подтверждает слово, а не отправку.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  let statusText: string | null = null;
  if (isPreparing) {
    statusText = 'Готовим изображения…';
  } else if (speech.availability !== 'available') {
    statusText = SPEECH_UNAVAILABLE_TEXT[speech.availability];
  } else if (speech.isListening) {
    statusText = 'Слушаю. Говорите — текст появится в поле.';
  }

  return (
    <form
      className={styles.composer}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label htmlFor={fieldId} className={styles.label}>
        Сообщение помощнику
      </label>

      {/* Поле и значки в одной рамке: так скрепка и микрофон не «висят» рядом с textarea. */}
      <div className={styles.editor}>
        <textarea
          id={fieldId}
          className={styles.field}
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          enterKeyHint="send"
          placeholder="Например: как проверить давление масла?"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => void addFiles(event)}
        />
        <div className={styles.tools}>
          <Button
            iconOnly
            aria-label="Прикрепить изображение"
            title="Прикрепить изображение"
            disabled={attachments.length >= MAX_IMAGES || isPreparing}
            onClick={() => fileInputRef.current?.click()}
          >
            <PaperclipIcon />
          </Button>
          {speech.availability === 'available' && (
            <Button
              iconOnly
              aria-label="Голосовой ввод"
              aria-pressed={speech.isListening}
              title={speech.isListening ? 'Закончить запись' : 'Продиктовать сообщение'}
              onClick={speech.toggle}
            >
              <MicrophoneIcon />
            </Button>
          )}
        </div>
      </div>

      {attachments.length > 0 && (
        <ul className={styles.attachments} aria-label="Приложенные изображения">
          {attachments.map((attachment) => (
            <li key={attachment.id} className={styles.attachment}>
              <img className={styles.thumbnail} src={attachment.previewUrl} alt="" />
              <span className={styles.attachmentName}>{attachment.file.name}</span>
              <Button
                aria-label={`Убрать изображение ${attachment.file.name}`}
                onClick={() => removeAttachment(attachment.id)}
              >
                Убрать
              </Button>
            </li>
          ))}
        </ul>
      )}

      {attachmentProblems.length > 0 && (
        <Notice tone="warning" title="Не все изображения добавлены">
          {attachmentProblems.map((problem) => (
            <p key={problem}>{problem}</p>
          ))}
        </Notice>
      )}

      {speech.error !== null && (
        <Notice tone="warning" title="Голосовой ввод не сработал">
          <p>{SPEECH_ERROR_TEXT[speech.error]}</p>
        </Notice>
      )}

      <div className={styles.footer}>
        <p className={styles.status} role="status">
          {statusText}
        </p>
        <Button type="submit" variant="primary" disabled={!canSend} isBusy={isSending}>
          Отправить
        </Button>
      </div>
    </form>
  );
}

function PaperclipIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m21 11.5-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9" />
    </svg>
  );
}

function MicrophoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}
