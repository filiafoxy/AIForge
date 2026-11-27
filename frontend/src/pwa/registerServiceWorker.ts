/**
 * Регистрирует сервис-воркер, который делает приложение устанавливаемым и доступным без сети.
 *
 * Только в собранном приложении: в `npm run dev` воркер мешал бы горячей перезагрузке. Браузер
 * разрешает сервис-воркеры только на `https://` и `localhost`; на обычном `http://` вызова
 * `register` нет, приложение работает как раньше. Сбой регистрации не должен ломать приложение,
 * поэтому ошибка только попадает в консоль.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  // После `load`, чтобы установка воркера не отнимала сеть у первой загрузки страницы.
  window.addEventListener('load', () => {
    const baseUrl = import.meta.env.BASE_URL;
    navigator.serviceWorker.register(`${baseUrl}sw.js`, { scope: baseUrl }).catch((error: unknown) => {
      console.warn('Не удалось зарегистрировать сервис-воркер', error);
    });
  });
}
