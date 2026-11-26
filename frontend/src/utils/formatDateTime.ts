const dateTimeFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Дата и время для интерфейса: «29 октября 2026 г. в 15:20», в часовом поясе устройства.
 * Строку, которую не удалось разобрать, возвращает как есть.
 */
export function formatDateTime(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  return Number.isNaN(date.getTime()) ? isoDateTime : dateTimeFormat.format(date);
}
