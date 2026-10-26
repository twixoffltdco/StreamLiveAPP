/**
 * Конфигурация источников StreamLive.
 * Failover: Prod → Reserve → Mirror3.
 */

/** Основной сервер (Prod) */
export const PROD_BASE = process.env.NEXT_PUBLIC_PROD_BASE ?? 'https://streamlivetv.freedev.app';

/** Резервный сервер (Reserve) */
export const RESERVE_BASE = process.env.NEXT_PUBLIC_RESERVE_BASE ?? 'https://domtv.blyz.ru';

/** Третье зеркало */
export const MIRROR3_BASE =
  process.env.NEXT_PUBLIC_MIRROR3_BASE ?? 'https://streamliveru.web1337.net';

export type SourceOrigin = 'prod' | 'reserve' | 'mirror3';

/** Порядок failover при парсинге */
export const SOURCE_BASES: Array<{ base: string; origin: SourceOrigin }> = [
  { base: PROD_BASE, origin: 'prod' },
  { base: RESERVE_BASE, origin: 'reserve' },
  { base: MIRROR3_BASE, origin: 'mirror3' },
];

/** Таймаут одного запроса к источнику, мс */
export const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS ?? 4000);

export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const FEED_LIMIT = Number(process.env.FEED_LIMIT ?? 12);

/** Как часто ходить за НОВЫМИ ссылками (сек). 900 = 15 мин */
export const FEED_REFRESH_SEC = Number(process.env.FEED_REFRESH_SEC ?? 900);

/** Макс. новых страниц за один refresh */
export const MAX_NEW_SCRAPE_PER_RUN = Number(process.env.MAX_NEW_SCRAPE_PER_RUN ?? 3);

/** Пауза между парсами новых карточек, мс */
export const SCRAPE_DELAY_MS = Number(process.env.SCRAPE_DELAY_MS ?? 700);

export const FOREVER_REVALIDATE = 60 * 60 * 24 * 365;
