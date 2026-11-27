import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

/**
 * Файлы из `public/`, которые нужны оболочке приложения. Vite копирует их как есть и в список
 * сборки не включает, поэтому они перечислены здесь. Новый файл в `public/`, нужный без сети,
 * добавляйте сюда: несуществующий путь ломает установку сервис-воркера.
 */
const PUBLIC_SHELL_FILES = [
  'favicon.svg',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

/**
 * Собирает сервис-воркер: берёт `pwa/sw.js`, дописывает в начало идентификатор сборки и список
 * файлов оболочки (скрипты, стили, картинки из сборки плюс `PUBLIC_SHELL_FILES`) и кладёт результат
 * в корень `dist/sw.js`. Зависимостей нет: вместо библиотеки для PWA — этот небольшой плагин.
 *
 * Идентификатор сборки меняется при каждой сборке, поэтому у каждой сборки свой кэш, а браузер,
 * увидев изменившийся `sw.js`, ставит новую версию и удаляет старый кэш.
 */
export function pwaPlugin(): Plugin {
  const workerSource = readFileSync(new URL('./sw.js', import.meta.url), 'utf-8');

  return {
    name: 'digital-mechanic-pwa',
    apply: 'build',
    generateBundle(_options, bundle) {
      const buildFiles = Object.keys(bundle).filter(
        // Страница отдаётся по адресу корня (`./` в сервис-воркере), карты кода в кэш не нужны.
        (fileName) => fileName !== 'index.html' && !fileName.endsWith('.map'),
      );
      const header = [
        `const BUILD_ID = ${JSON.stringify(Date.now().toString(36))};`,
        `const PRECACHE_URLS = ${JSON.stringify([...buildFiles, ...PUBLIC_SHELL_FILES], null, 2)};`,
        '',
        '',
      ].join('\n');

      this.emitFile({ type: 'asset', fileName: 'sw.js', source: header + workerSource });
    },
  };
}
