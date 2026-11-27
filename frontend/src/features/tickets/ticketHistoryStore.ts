// Локальная история заявок (FR-12).
// ТОиР не отдаёт список заявок, поэтому созданные заявки запоминает браузер — в localStorage.

import { useSyncExternalStore } from 'react';
import { isRecord } from '../../api/http';

export interface TicketHistoryEntry {
  ticket_id: string;
  vehicle_id: string;
  session_id: string;
  /** Когда приложение получило номер заявки, в формате ISO 8601. */
  created_at: string;
}

const STORAGE_KEY = 'digital-mechanic:ticket-history:v1';

/** Текущий список, новые заявки в начале. `null` — ещё не читали или хранилище изменилось извне. */
let entries: readonly TicketHistoryEntry[] | null = null;
const listeners = new Set<() => void>();

function isHistoryEntry(value: unknown): value is TicketHistoryEntry {
  return (
    isRecord(value) &&
    typeof value.ticket_id === 'string' &&
    typeof value.vehicle_id === 'string' &&
    typeof value.session_id === 'string' &&
    typeof value.created_at === 'string'
  );
}

/** Читает историю из хранилища. Содержимое мог изменить кто угодно, поэтому негодные записи отбрасываются. */
function readStoredEntries(): readonly TicketHistoryEntry[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(stored) ? stored.filter(isHistoryEntry) : [];
  } catch {
    // Хранилище недоступно или в нём не JSON — история считается пустой.
    return [];
  }
}

function notifyListeners() {
  for (const listener of listeners) listener();
}

// Заявку могли создать в другой вкладке: тогда список перечитывается.
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) {
    entries = null;
    notifyListeners();
  }
});

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTicketHistory(): readonly TicketHistoryEntry[] {
  entries ??= readStoredEntries();
  return entries;
}

/**
 * Добавляет заявку в историю.
 *
 * @returns `false`, если записать в хранилище не удалось: заявка видна до перезагрузки страницы, но не сохранится.
 */
export function addTicketToHistory(entry: TicketHistoryEntry): boolean {
  entries = [entry, ...getTicketHistory()];
  notifyListeners();

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch (cause) {
    console.error('Не удалось сохранить историю заявок:', cause);
    return false;
  }
}

/** История заявок этого браузера; компонент перерисовывается, когда она меняется. */
export function useTicketHistory(): readonly TicketHistoryEntry[] {
  return useSyncExternalStore(subscribe, getTicketHistory);
}
