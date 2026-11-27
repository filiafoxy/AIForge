// Изображения к сообщению помощнику: что принимаем, как готовим к отправке и что говорим при отказе.
// Только правила и преобразование файла, без разметки.

/** Сколько изображений можно приложить к одному сообщению. */
export const MAX_IMAGES = 5;

/** Больше этого размера исходный файл даже не читаем: фото с телефона обычно в разы меньше. */
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
/** Больше этого размера после сжатия файл не отправляем: шлюз перед агентом может его не принять. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Длинная сторона после сжатия: для разбора неисправности по фото хватает с запасом. */
const MAX_SIDE_PX = 1600;
const JPEG_QUALITY = 0.85;
const MAX_NAME_LENGTH = 80;

export type ImageRejection = 'not_image' | 'too_large' | 'unreadable';

/** Файл не подошёл. Причина — для текста механику; сам файл в сообщение не попадает. */
export class ImageRejectedError extends Error {
  readonly reason: ImageRejection;

  constructor(reason: ImageRejection, options?: ErrorOptions) {
    super(`Image rejected: ${reason}`, options);
    this.name = 'ImageRejectedError';
    this.reason = reason;
  }
}

/** Изображение, готовое к отправке, и адрес для его показа в приложении. */
export interface ImageAttachment {
  /** Номер в списке: по нему изображения различаются при удалении. */
  id: number;
  /** Файл, который уйдёт агенту. */
  file: File;
  /** Адрес `blob:` для миниатюры. Освобождается через `URL.revokeObjectURL`. */
  previewUrl: string;
}

/** Краткий вид изображения в ленте: имя и адрес для показа. */
export interface MessageImage {
  name: string;
  url: string;
}

export function describeRejection(name: string, reason: ImageRejection): string {
  switch (reason) {
    case 'not_image':
      return `«${name}» — не изображение. Приложите фотографию или снимок экрана.`;
    case 'too_large':
      return `«${name}» слишком большое. Приложите изображение поменьше.`;
    case 'unreadable':
      return `«${name}» не удалось прочитать. Возможно, этот браузер не поддерживает такой формат (например, HEIC): приложите JPEG или PNG.`;
  }
}

/** Имя файла без пути и с расширением `.jpg`: после сжатия формат всегда JPEG. */
function toJpegName(name: string): string {
  const base = name.split(/[\\/]/).at(-1) ?? '';
  const stem = base.replace(/\.[^.]*$/, '').trim().slice(0, MAX_NAME_LENGTH);
  return `${stem === '' ? 'image' : stem}.jpg`;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
}

/**
 * Готовит изображение к отправке: проверяет, что это растровая картинка, уменьшает длинную
 * сторону до `MAX_SIDE_PX` и сохраняет как JPEG. Сжатие нужно, чтобы запрос быстро уходил по
 * мобильной сети и проходил лимиты шлюза; заодно из файла пропадают метаданные съёмки, в том числе
 * координаты. Прозрачные места заливаются белым: в JPEG прозрачности нет. У анимации остаётся первый кадр.
 *
 * @throws ImageRejectedError, если файл не подошёл.
 */
export async function prepareImage(file: File): Promise<File> {
  // SVG — это текст с разметкой, а не снимок: его не принимаем.
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') throw new ImageRejectedError('not_image');
  if (file.size > MAX_SOURCE_BYTES) throw new ImageRejectedError('too_large');

  let bitmap: ImageBitmap;
  try {
    // Поворот по метаданным применяется при чтении: фото с телефона не окажется набок.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (cause) {
    throw new ImageRejectedError('unreadable', { cause });
  }

  try {
    const scale = Math.min(1, MAX_SIDE_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext('2d');
    if (context === null) throw new ImageRejectedError('unreadable');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await canvasToBlob(canvas);
    if (blob === null) throw new ImageRejectedError('unreadable');
    if (blob.size > MAX_UPLOAD_BYTES) throw new ImageRejectedError('too_large');

    return new File([blob], toJpegName(file.name), { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
