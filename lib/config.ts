/**
 * Конфигурация источников StreamLive.
 * Двойной источник с failover: Prod -> Reserve.
 */

/** Основной сервер (Prod) */
export const PROD_BASE = process.env.NEXT_PUBLIC_PROD_BASE ?? 'https://streamlivetv.freedev.app';

/** Резервный сервер (Reserve) */
export const RESERVE_BASE = process.env.NEXT_PUBLIC_RESERVE_BASE ?? 'https://domtv.blyz.ru';

/** Таймаут одного запроса к источнику, мс (>N сек => failover) */
export const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS ?? 4000);

/** User-Agent для парсинга */
export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Сколько карточек в ленте */
export const FEED_LIMIT = Number(process.env.FEED_LIMIT ?? 12);

/**
 * Как часто агрегатор ходит на PHP за НОВЫМИ ссылками (секунды).
 * 900 = 15 минут. Между этим — только архив/кэш, InfinityFree не трогаем.
 */
export const FEED_REFRESH_SEC = Number(process.env.FEED_REFRESH_SEC ?? 900);

/**
 * За один refresh парсим максимум столько НОВЫХ страниц (не из архива).
 * Остальное берём из вечной копии. Защита antibot 25/20с на InfinityFree.
 */
export const MAX_NEW_SCRAPE_PER_RUN = Number(process.env.MAX_NEW_SCRAPE_PER_RUN ?? 3);

/** Пауза между запросами к PHP при парсе новых карточек, мс */
export const SCRAPE_DELAY_MS = Number(process.env.SCRAPE_DELAY_MS ?? 700);

/** Период "вечного" revalidation метаданных карточки */
export const FOREVER_REVALIDATE = 60 * 60 * 24 * 365;
