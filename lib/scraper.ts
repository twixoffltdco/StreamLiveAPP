/**
 * lib/scraper.ts — универсальный серверный парсер StreamLive.
 *
 * Архитектура (production-ready, только реальный fetch, без мок-данных):
 *  1. FAILOVER: PROD_DOMAIN (https://streamlivetv.freedev.app) опрашивается
 *     первым; при таймауте (>3 сек), сетевой ошибке или HTTP 5xx запрос
 *     мгновенно и прозрачно переносится на RESERVE_DOMAIN (https://domtv.blyz.ru).
 *  2. USER-AGENT: каждый fetch идёт с браузерным User-Agent (lib/config.ts).
 *  3. CHEERIO: HTML разбирается на сервере — title, description, og:image,
 *     сетка каналов главной страницы, ссылки каталога.
 *  4. ВЕЧНЫЙ КЭШ: все экспортируемые парсеры обёрнуты в `unstable_cache`
 *     из next/cache с revalidate:false — однажды спаршенные метаданные
 *     сохраняются в Next.js навсегда, даже если оба источника умрут.
 *     Поверх этого работает файловый архив data/archive.json (lib/cache.ts).
 *  5. JS-защита источников (slowAES cookie-challenge + proof-of-work
 *     «Проверка браузера») решается на сервере честной криптографией
 *     (lib/challenge.ts) — никакого заготовленного контента.
 */

import { createHash } from 'crypto';
import { FEED_LIMIT, PROD_BASE, RESERVE_BASE } from './config';
import { fetchWithChallenge } from './challenge';
import { contentId, foreverCachePage, getArchivedItems, persistToArchive } from './cache';
import { detectKind, extractContentLinks, mapToEmbed, parseMeta } from './parse';
import type { FeedResult, StreamContent } from './types';

/* ============================================================================
 * 1. FAILOVER-ЯДРО: PROD -> RESERVE
 * ==========================================================================*/

/** Ошибка источника */
export class SourceError extends Error {
  /** recoverable=false — повтор через резервный домен бессмыслен */
  recoverable: boolean;
  constructor(message: string, recoverable = true) {
    super(message);
    this.name = 'SourceError';
    this.recoverable = recoverable;
  }
}

export interface ScrapedPage {
  html: string;
  /** Честный ответ: с какого сервера реально пришли данные */
  origin: 'prod' | 'reserve';
  finalUrl: string;
}

const RESERVE_ORIGIN = new URL(RESERVE_BASE).origin;

/** Пробует один абсолютный URL; возвращает null вместо исключения */
async function tryFetch(url: string): Promise<{ html: string; finalUrl: string } | null> {
  try {
    return await fetchWithChallenge(url);
  } catch (e) {
    console.warn(`[scraper] ${url} недоступен:`, (e as Error).message);
    return null;
  }
}

/**
 * Стучится сначала в PROD. Если таймаут (>3 сек) или ошибка (5xx/сеть/DNS/TLS) —
 * мгновенно и прозрачно переключаемся на RESERVE.
 */
export async function fetchFailover(pathname: string): Promise<ScrapedPage> {
  const attempts: Array<{ url: string; origin: 'prod' | 'reserve' }> = [
    { url: `${PROD_BASE}${pathname}`, origin: 'prod' },
    { url: `${RESERVE_BASE}${pathname}`, origin: 'reserve' },
  ];

  let lastError = '';
  for (const attempt of attempts) {
    const ok = await tryFetch(attempt.url);
    if (ok) return { html: ok.html, origin: attempt.origin, finalUrl: ok.finalUrl };
    lastError = `Источник ${attempt.origin} (${attempt.url}) не ответил`;
  }

  throw new SourceError(lastError || 'Оба источника недоступны');
}

/** То же для произвольного абсолютного URL (прозрачная подмена домена на резервный) */
async function fetchAnyUrl(sourceUrl: string): Promise<ScrapedPage> {
  const u = new URL(sourceUrl);
  const path = `${u.pathname}${u.search}`;
  const preferReserve = u.origin === RESERVE_ORIGIN;
  const ordered = preferReserve
    ? ([{ base: RESERVE_BASE, origin: 'reserve' as const },
       { base: PROD_BASE, origin: 'prod' as const }])
    : ([{ base: PROD_BASE, origin: 'prod' as const },
       { base: RESERVE_BASE, origin: 'reserve' as const }]);

  let lastError = '';
  for (const step of ordered) {
    const ok = await tryFetch(`${step.base}${path}`);
    if (ok) return { html: ok.html, origin: step.origin, finalUrl: ok.finalUrl };
    lastError = `Источник ${step.origin} недоступен`;
  }
  throw new SourceError(lastError || `Источник недоступен: ${sourceUrl}`);
}

/* ============================================================================
 * 2. КОНТЕНТ: главная лента и страницы видео/каналов
 * ==========================================================================*/

/** Парсит одну страницу контента и собирает карточку StreamContent */
async function scrapeContent(sourceUrl: string): Promise<StreamContent> {
  const { html, origin } = await fetchAnyUrl(sourceUrl);

  const meta = parseMeta(html);
  if (!meta.title) {
    throw new SourceError(`Не удалось извлечь <title> из ${sourceUrl}`, false);
  }

  return {
    id: contentId(sourceUrl),
    title: meta.title,
    description: meta.description || 'Прямой эфир без описания — смотрите в плеере.',
    image: meta.image,
    sourceUrl,
    embedUrl: mapToEmbed(sourceUrl),
    kind: detectKind(sourceUrl),
    origin,
    cachedAt: new Date().toISOString(),
  };
}

/** Версия scrapeContent, закешированная НАВСЕГДА (unstable_cache, revalidate:false) */
const scrapeContentForever = foreverCachePage(scrapeContent);

/**
 * Лента главной страницы: индекс источника -> реальные ссылки channel/video.php ->
 * параллельный парсинг метаданных каждой страницы -> вечный кэш + архив.
 */
export async function fetchFeed(limit = FEED_LIMIT): Promise<FeedResult> {
  try {
    // 1. Индексная страница с failover
    const { html: indexHtml } = await fetchFailover('/');

    // 2. Реальные ссылки на контент со страницы источника
    let links = extractContentLinks(indexHtml, PROD_BASE);

    // Источник может редиректить «голый» GET / на каталог — идём туда напрямую
    if (links.length === 0) {
      for (const path of ['/catalog', '/channels', '/index.php']) {
        try {
          const { html } = await fetchFailover(path);
          links = extractContentLinks(html, PROD_BASE);
          if (links.length > 0) break;
        } catch {
          /* пробуем следующий путь */
        }
      }
    }

    // 3. Параллельный парсинг (каждая страница через вечный кэш)
    const settled = await Promise.allSettled(
      links.slice(0, limit).map((url) => scrapeContentForever(url)),
    );
    const items: StreamContent[] = settled.flatMap((s) =>
      s.status === 'fulfilled' ? [s.value] : [],
    );

    // 4. Сохраняем всё успешно спаршенное в вечный файловый архив
    void persistToArchive(items);

    if (items.length === 0) {
      // Ни одной распаршенной карточки — достраиваем ленту из архива
      const archived = await getArchivedItems(limit);
      if (archived.length > 0) return { items: archived, allFailed: false };
      return {
        items: [],
        allFailed: true,
        error: 'Источник доступен, но не вернул ни одной страницы контента.',
      };
    }

    return { items, allFailed: false };
  } catch (e) {
    // Оба сервера упали — сначала отдаём ВЕЧНЫЙ АРХИВ, иначе «Технические работы»
    const archived = await getArchivedItems(limit);
    if (archived.length > 0) return { items: archived, allFailed: false };
    return {
      items: [],
      allFailed: true,
      error: (e as Error).message || 'Техническая ошибка источника',
    };
  }
}

/** Поиск: реальная выдача источника (?s=) + fallback на вечный локальный архив */
export async function searchFeed(query: string, limit = FEED_LIMIT): Promise<FeedResult> {
  const q = encodeURIComponent(query.trim());
  try {
    const { html } = await fetchFailover(`/?s=${q}`);
    const links = extractContentLinks(html, PROD_BASE);
    const settled = await Promise.allSettled(
      links.slice(0, limit).map((url) => scrapeContentForever(url)),
    );
    const items = settled.flatMap((s) => (s.status === 'fulfilled' ? [s.value] : []));
    void persistToArchive(items);
    if (items.length > 0) return { items, allFailed: false };
  } catch {
    /* падаем в архив */
  }

  const lower = query.toLowerCase();
  const archived = (await getArchivedItems(10_000)).filter(
    (i) => i.title.toLowerCase().includes(lower) || i.description.toLowerCase().includes(lower),
  );
  return { items: archived.slice(0, limit), allFailed: false };
}

/**
 * Парсит и возвращает конкретную страницу источника (channel.php / video.php)
 * через вечный кэш; при отказе обоих серверов — из вечного файлового архива.
 * Используется страницей /watch/[id] (id карточки = md5 от исходного URL)
 * и API /api/fetch-content.
 */
export async function fetchContentBySourceUrl(sourceUrl: string): Promise<StreamContent | null> {
  try {
    const item = await scrapeContentForever(sourceUrl);
    void persistToArchive([item]);
    return item;
  } catch {
    const archived = await getArchivedItems(10_000);
    return archived.find((i) => i.sourceUrl === sourceUrl) ?? null;
  }
}

/** Карточка по id — только из вечной копии (без хита на PHP при каждом /watch). */
export async function fetchContentById(id: string): Promise<StreamContent | null> {
  const archived = await getArchivedItems(10_000);
  return archived.find((i) => i.id === id) ?? null;
}

/** Хэш для стабильных ключей (совпадает с id карточек) */
export function hashKey(input: string): string {
  return createHash('sha1').update(input).digest('hex').slice(0, 12);
}
