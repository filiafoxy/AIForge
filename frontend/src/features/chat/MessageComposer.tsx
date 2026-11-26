import { useId, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { useSpeechInput } from './useSpeechInput';
import type { SpeechAvailability, SpeechInputError } from './useSpeechInput';
import styles from './MessageComposer.module.css';

interface MessageComposerProps {
  /** Ждём ответ на предыдущее сообщение: новое пока отправить нельзя, но набирать можно. */
  isSending: boolean;
  onSend: (text: string) => void;
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
 * Поле для вопроса помощнику: текст с клавиатуры или голосом.
 *
 * Распознанная речь попадает в поле, а не уходит сразу: механик видит, что получилось,
 * может поправить и отправляет сам (FR-14).
 */
export function MessageComposer({ isSending, onSend }: MessageComposerProps) {
  const [draft, setDraft] = useState('');
  const fieldId = useId();
  const speech = useSpeechInput((phrase) => setDraft((current) => appendDictation(current, phrase)));

  const canSend = draft.trim() !== '';

  function submit() {
    if (!canSend || isSending) return;
    // Микрофон выключаем: иначе фраза, сказанная до отправки, попала бы в уже очищенное поле.
    speech.cancel();
    onSend(draft);
    setDraft('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter отправляет, Shift+Enter переносит строку. Пока идёт набор через экранную
    // клавиатуру с подстановкой (IME), Enter подтверждает слово, а не отправку.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
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

      <div className={styles.inputRow}>
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
        {speech.availability === 'available' && (
          <Button
            aria-label="Голосовой ввод"
            aria-pressed={speech.isListening}
            title={speech.isListening ? 'Закончить запись' : 'Продиктовать сообщение'}
            onClick={speech.toggle}
          >
            <MicrophoneIcon />
          </Button>
        )}
      </div>

      {speech.error !== null && (
        <Notice tone="warning" title="Голосовой ввод не сработал">
          <p>{SPEECH_ERROR_TEXT[speech.error]}</p>
        </Notice>
      )}

      <div className={styles.footer}>
        {speech.availability === 'available' ? (
          <p className={styles.status} role="status">
            {speech.isListening && 'Слушаю. Говорите — текст появится в поле.'}
          </p>
        ) : (
          <p className={styles.status}>{SPEECH_UNAVAILABLE_TEXT[speech.availability]}</p>
        )}
        <Button type="submit" variant="primary" disabled={!canSend} isBusy={isSending}>
          Отправить
        </Button>
      </div>
    </form>
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
