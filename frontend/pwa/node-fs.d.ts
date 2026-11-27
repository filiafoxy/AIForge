// Пакета `@types/node` в проекте нет, а плагину сборки нужно одно чтение файла.
// Описан только этот вызов; новые модули Node.js здесь не добавляйте без пакета типов.
declare module 'node:fs' {
  export function readFileSync(path: URL, encoding: 'utf-8'): string;
}
