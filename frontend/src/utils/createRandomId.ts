/**
 * Случайный идентификатор, который не повторится у другого диалога или другого браузера.
 *
 * `crypto.randomUUID` есть только на страницах, открытых по https или с localhost,
 * поэтому для остальных случаев идентификатор собирается из случайных байтов.
 */
export function createRandomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
