/**
 * Конфигурация источников StreamLive.
 * Двойной источник с failover: Prod -> Reserve.
 */

/** Основной сервер (Prod) */
export const PROD_BASE = process.env.NEXT_PUBLIC_PROD_BASE ?? 'https://streamlivetv.freedev.app';

/** Резервный сервер (Reserve) */
export const RESERVE_BASE = process.env.NEXT_PUBLIC_RESERVE_BASE ?? 'https://domtv.blyz.ru';

/** Таймаут одного запроса к источнику, мс (>3 сек => failover) */
export const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS ?? 3000);

/** User-Agent для подмены при парсинге (аналог PHP file_get_contents с context) */
export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Сколько страниц брать в ленту за один проход */
export const FEED_LIMIT = Number(process.env.FEED_LIMIT ?? 12);

/** Период "вечного" revalidation: 1 год (данные архивируются навсегда) */
export const FOREVER_REVALIDATE = 60 * 60 * 24 * 365;
