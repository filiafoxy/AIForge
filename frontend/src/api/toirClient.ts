// Клиент ТОиР. Контракт: POST /tickets.

import { toirServiceUrl } from '../config/env';
import type { TicketRequest, TicketResponse } from '../types/ticket';
import { ApiError, isRecord, postJson } from './http';

/** Ответ приходит извне, поэтому его форму проверяем сами, а не верим типам на слово. */
function isTicketResponse(value: unknown): value is TicketResponse {
  return (
    isRecord(value) &&
    typeof value.ticket_id === 'string' &&
    value.ticket_id.trim() !== '' &&
    value.status === 'created'
  );
}

/**
 * Создаёт заявку на дефектовку и возвращает её номер.
 *
 * @throws ApiError при любом сбое; ошибку отмены — если запрос отменён через `signal`.
 */
export async function createTicket(request: TicketRequest, signal?: AbortSignal): Promise<TicketResponse> {
  const body = await postJson(toirServiceUrl, '/tickets', request, signal);

  if (!isTicketResponse(body)) {
    throw new ApiError('invalid_response', { httpStatus: 201 });
  }
  return body;
}
