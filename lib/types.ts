/**
 * Общие типы StreamLive Web App.
 * Все данные — только реальные, спаршенные с серверов-источников.
 */

/** Тип страницы источника: прямой эфир канала или видео по запросу */
export type ContentKind = 'channel' | 'video';

/** Одна карточка контента в ленте */
export interface StreamContent {
  /** Уникальный ключ (хэш исходного URL) */
  id: string;
  /** Чистый заголовок (без суффикса "— Смотрим") */
  title: string;
  /** meta description страницы источника */
  description: string;
  /** og:image — превью карточки */
  image: string | null;
  /** Исходная страница (channel.php / video.php) */
  sourceUrl: string;
  /** Маппинг: embed.php / embed_video.php для iframe-плеера */
  embedUrl: string;
  kind: ContentKind;
  /** Сервер, с которого реально получены данные */
  origin: 'prod' | 'reserve';
  /** ISO-дата кэширования */
  cachedAt: string;
}

/** Результат работы фетчера для ленты */
export interface FeedResult {
  items: StreamContent[];
  /** true, если оба сервера недоступны */
  allFailed: boolean;
  /** Причина отказа (для экрана "Технические работы") */
  error?: string;
}

/** Одна тема форума в списке (/forum) */
export interface ForumThreadSummary {
  /** Числовой id темы на источнике */
  id: string;
  /** Заголовок темы (реальный, спаршенный) */
  title: string;
  /** Абсолютная ссылка на тему на источнике */
  href: string;
}

/** Список тем форума */
export interface ForumThreadList {
  threads: ForumThreadSummary[];
  origin: 'prod' | 'reserve';
  allFailed: boolean;
  error?: string;
}

/** Полная тема форума (/forum/[id]) с очищенным содержимым */
export interface ForumThread {
  id: string;
  title: string;
  description: string;
  image: string | null;
  /** Санитизированный HTML постов (без script/style/form/iframe) */
  postsHtml: string;
  /** Плоский читабельный текст темы */
  plainText: string;
  sourceUrl: string;
  origin: 'prod' | 'reserve';
  cachedAt: string;
}
