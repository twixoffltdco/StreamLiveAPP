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
