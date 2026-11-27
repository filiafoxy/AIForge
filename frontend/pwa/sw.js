// Сервис-воркер «Цифрового механика». Задача одна: чтобы установленное на телефон приложение
// открывалось без сети и быстро на слабой связи. К данным он не прикасается.
//
// Перед этим файлом при сборке дописываются две константы (см. `pwa/pwaPlugin.ts`):
//   BUILD_ID        — идентификатор сборки, он же суффикс имени кэша;
//   PRECACHE_URLS   — файлы оболочки приложения, пути относительно адреса сервис-воркера.
//
// Правила:
// - Обрабатываются только GET-запросы к своему адресу. Запросы к ML, ТОиР и агенту (другой адрес)
//   и любые POST воркер не видит: ответы сервисов никогда не кэшируются.
// - Страница открывается «сеть сначала»: свежая версия, а при обрыве или долгом ожидании —
//   оболочка из кэша. Остальные файлы оболочки отдаются из кэша.
// - Новая сборка = новый кэш. Старые кэши приложения удаляются при активации.

/* global BUILD_ID, PRECACHE_URLS */

const CACHE_PREFIX = 'digital-mechanic-';
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_ID}`;
const NAVIGATION_TIMEOUT_MS = 4000;

const scopeUrl = self.registration.scope;
const shellUrl = new URL('./', scopeUrl).href;
const precacheUrls = [shellUrl, ...PRECACHE_URLS.map((path) => new URL(path, scopeUrl).href)];
const precacheSet = new Set(precacheUrls);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // `reload` обходит HTTP-кэш браузера: в кэш приложения должны попасть файлы этой сборки.
      .then((cache) => cache.addAll(precacheUrls.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Только файлы оболочки. Всё остальное (в том числе запросы к API на том же адресе)
  // идёт в сеть как обычно, воркер его не кэширует.
  if (precacheSet.has(url.href)) {
    event.respondWith(handleShellFile(request));
  }
});

/** Открытие страницы: сеть сначала, при сбое — оболочка приложения из кэша. */
async function handleNavigation(request) {
  try {
    const response = await fetchWithTimeout(request, NAVIGATION_TIMEOUT_MS);
    // Ошибка сервера или прокси (5xx) тоже повод показать оболочку, если она есть.
    if (response.status < 500) return response;
    return (await matchShell(shellUrl)) ?? response;
  } catch {
    return (await matchShell(shellUrl)) ?? Response.error();
  }
}

/** Файл оболочки: из кэша, а если его там нет — из сети. */
async function handleShellFile(request) {
  const cached = await matchShell(request);
  return cached ?? fetch(request);
}

/**
 * Поиск в кэше без учёта `Vary`. Сервер отвечает с `Vary: Origin`, а запрос модульного скрипта
 * приходит с заголовком `Origin`, которого не было при кэшировании: без `ignoreVary` кэш считает
 * такие запросы разными, и скрипт не находится. Файлы оболочки неизменяемые, поэтому это безопасно.
 */
function matchShell(request) {
  return caches.match(request, { ignoreVary: true });
}

/**
 * Запрос с ограничением ожидания. Запрос не отменяется, а просто перестаём его ждать: так
 * навигационный запрос уходит в сеть без изменений (с `signal` браузер пересоздаёт его).
 */
function fetchWithTimeout(request, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
  });
  return Promise.race([fetch(request), timeout]).finally(() => clearTimeout(timer));
}
