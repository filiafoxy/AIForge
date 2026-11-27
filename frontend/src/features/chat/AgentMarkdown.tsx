import Markdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './AgentMarkdown.module.css';

interface AgentMarkdownProps {
  /** Ответ помощника в разметке Markdown. Внешний текст: HTML из него не исполняется. */
  text: string;
}

const REMARK_PLUGINS = [remarkGfm];

/** Картинки по внешним адресам из ответа не загружаем: это запросы на чужие серверы со страницы механика. */
const DISALLOWED_ELEMENTS = ['img'];

/**
 * Лента идёт под заголовком второго уровня «Диалог с помощником», поэтому заголовки из ответа
 * понижаются: `#` в ответе не должен стать вторым главным заголовком страницы.
 */
const COMPONENTS: Components = {
  h1: ({ node: _node, ...props }) => <h3 {...props} />,
  h2: ({ node: _node, ...props }) => <h4 {...props} />,
  h3: ({ node: _node, ...props }) => <h5 {...props} />,
  h4: ({ node: _node, ...props }) => <h6 {...props} />,
  h5: ({ node: _node, ...props }) => <h6 {...props} />,
  // Ссылка из ответа ведёт на чужой сайт: открываем в новой вкладке, чтобы не потерять диалог и заявку.
  // Небезопасный адрес (`javascript:` и подобные) библиотека обнуляет — такую ссылку выводим текстом.
  a: ({ node: _node, href, children, ...props }) =>
    href ? (
      <a {...props} href={href} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  // Широкая таблица прокручивается сама, а не раздвигает страницу на телефоне.
  table: ({ node: _node, ...props }) => (
    <div className={styles.tableScroll} tabIndex={0} role="group" aria-label="Таблица, прокручивается по горизонтали">
      <table {...props} />
    </div>
  ),
};

/**
 * Ответ помощника с разметкой Markdown: заголовки, списки, таблицы, код, ссылки.
 *
 * Разметку разбирает `react-markdown`: он строит элементы React, а не HTML-строку, и теги HTML
 * из ответа выводит текстом. Подключать к нему разбор HTML (`rehype-raw`) нельзя.
 */
export function AgentMarkdown({ text }: AgentMarkdownProps) {
  return (
    <div className={styles.markdown}>
      <Markdown remarkPlugins={REMARK_PLUGINS} components={COMPONENTS} disallowedElements={DISALLOWED_ELEMENTS}>
        {text}
      </Markdown>
    </div>
  );
}
