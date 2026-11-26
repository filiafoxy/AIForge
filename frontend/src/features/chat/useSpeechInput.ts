// Голосовой ввод (FR-14): распознавание речи средствами браузера.
// Распознанный текст отдаётся вызывающему коду — что с ним делать, решает он.

import { useEffect, useRef, useState } from 'react';

/**
 * Можно ли пользоваться голосовым вводом:
 * - `available` — можно;
 * - `unsupported` — браузер не умеет распознавать речь;
 * - `insecure` — страница открыта не по https и не с localhost, браузер не даст микрофон.
 */
export type SpeechAvailability = 'available' | 'unsupported' | 'insecure';

export type SpeechInputError = 'not_allowed' | 'no_speech' | 'no_microphone' | 'network' | 'unknown';

interface UseSpeechInputResult {
  availability: SpeechAvailability;
  isListening: boolean;
  /** Почему последняя попытка не удалась; сбрасывается при следующей. */
  error: SpeechInputError | null;
  /** Начинает слушать, а если уже слушает — заканчивает и отдаёт то, что успел распознать. */
  toggle: () => void;
  /** Прекращает слушать и отбрасывает нераспознанное. Нужно, когда текст уже не понадобится. */
  cancel: () => void;
}

// Минимальное описание Web Speech API: только то, чем пользуется хук.
// В Chrome и Safari конструктор доступен под именем с префиксом `webkit`.
interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionConstructor = new () => Recognition;

function getRecognitionConstructor(): RecognitionConstructor | null {
  const source = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return source.SpeechRecognition ?? source.webkitSpeechRecognition ?? null;
}

function detectAvailability(): SpeechAvailability {
  if (getRecognitionConstructor() === null) return 'unsupported';
  return window.isSecureContext ? 'available' : 'insecure';
}

/** Переводит код ошибки браузера в причину; `null` — это не ошибка, а отмена. */
function toSpeechInputError(code: string): SpeechInputError | null {
  switch (code) {
    case 'aborted':
      return null;
    case 'not-allowed':
    case 'service-not-allowed':
      return 'not_allowed';
    case 'no-speech':
      return 'no_speech';
    case 'audio-capture':
      return 'no_microphone';
    case 'network':
      return 'network';
    default:
      return 'unknown';
  }
}

/**
 * @param onText Вызывается с распознанной фразой. Фраза приходит целиком, когда механик договорил.
 */
export function useSpeechInput(onText: (text: string) => void): UseSpeechInputResult {
  const [availability] = useState(detectAvailability);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<SpeechInputError | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);

  // Распознавание живёт дольше одной отрисовки, поэтому обработчик берём из ссылки: она всегда свежая.
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  });

  /** Останавливает распознавание так, чтобы оно больше ничего не прислало. */
  function discard() {
    const recognition = recognitionRef.current;
    if (recognition === null) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognition.abort();
    recognitionRef.current = null;
  }

  // Уходя со страницы, выключаем микрофон.
  useEffect(() => discard, []);

  function start() {
    const RecognitionClass = getRecognitionConstructor();
    if (RecognitionClass === null) return;

    const recognition = new RecognitionClass();
    recognition.lang = 'ru-RU';
    // Одна фраза за нажатие и только окончательный текст: так в поле не попадают черновые варианты.
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      let text = '';
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        if (result.isFinal) text += result[0].transcript;
      }
      text = text.trim();
      if (text !== '') onTextRef.current(text);
    };
    recognition.onerror = (event) => {
      const reason = toSpeechInputError(event.error);
      if (reason !== null) setError(reason);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };

    setError(null);
    try {
      recognition.start();
    } catch (cause) {
      console.error('Не удалось начать распознавание речи:', cause);
      setError('unknown');
      return;
    }
    recognitionRef.current = recognition;
    setIsListening(true);
  }

  function toggle() {
    if (recognitionRef.current !== null) {
      recognitionRef.current.stop();
    } else {
      start();
    }
  }

  function cancel() {
    discard();
    setIsListening(false);
    setError(null);
  }

  return { availability, isListening, error, toggle, cancel };
}
