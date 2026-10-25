/**
 * lib/fetcher.ts — серверный фетчер StreamLive.
 *
 * Ключевая логика:
 *  1. FAILOVER: сначала Prod (streamlivetv.freedev.app), при таймауте >3 сек
 *     или ошибке 5xx мгновенно переключаемся на Reserve (domtv.blyz.ru).
 *  2. УМНЫЙ ПАРСИНГ: обход JS-защиты (см. challenge.ts) + Cheerio извлечение
 *     title/description/og:image + endpoint-маппинг channel.php -> embed.php.
 *  3. ВЕЧНЫЙ КЭШ: unstable_cache + файловый архив data/archive.json.
 */

import { createHash } from 'crypto';
import { FEED_LIMIT, PROD_BASE, RESERVE_BASE } from './config';
import { fetchWithChallenge } from './challenge';
import { detectKind, extractContentLinks, extractVideoLinks, mapToEmbed, parseMeta } from './parse';
import { contentId, foreverCachePage, getArchivedItems, persistToArchive } from './cache';
import type { FeedResult, StreamContent } from './types';

/** Ошибка источника с признаком "стоит попробовать резерв" */
class SourceError extends Error {
  recoverable: boolean;
  constructor(message: string, recoverable = true) {
    super(message);
    this.recoverable = recoverable;
  }
}

/**
 * Пробует базовый URL: сначала Prod, при таймауте/5xx — Reserve.
 * Возвращает { html, origin }. Бросает SourceError, если оба мертвы.
 */
async function fetchPageFailover(pathname: string): Promise<{ html: string; origin: 'prod' | 'reserve'; finalUrl: string }> {
  const bases: Array<{ url: string; origin: 'prod' | 'reserve' }> = [
    { url: `${PROD_BASE}${pathname}`, origin: 'prod' },
    { url: `${RESERVE_BASE}${pathname}`, origin: 'reserve' },
  ];

  let lastError: Error | null = null;
  for (const base of bases) {
    try {
      const { html, finalUrl } = await fetchWithChallenge(base.url);
      return { html, origin: base.origin, finalUrl };
    } catch (e) {
      lastError = e as Error;
      console.warn(`[fetcher] ${base.origin} (${base.url}) недоступен:`, lastError.message);
      // Таймаут / 5xx / сетевая ошибка => failover на следующий источник
      continue;
    }
  }

  throw new SourceError(lastError?.message ?? 'Оба источника недоступны');
}

/** Парсит одну страницу контента и собирает карточку StreamContent */
async function scrapeContent(sourceUrl: string): Promise<StreamContent> {
  const { html, origin } = await fetchPageFailover(new URL(sourceUrl).pathname + new URL(sourceUrl).search);

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

/** Кэшированная навсегда версия scrapeContent (unstable_cache, revalidate = 1 год) */
const scrapeContentCached = foreverCachePage(scrapeContent);

/**
 * Собирает ленту: индексная страница источника -> ссылки на channel/video.php ->
 * параллельный парсинг метаданных каждой страницы -> вечный кэш.
 */
export async function fetchFeed(limit = FEED_LIMIT): Promise<FeedResult> {
  try {
    // 1. Индексная страница с failover
    const { html: indexHtml } = await fetchPageFailover('/');

    // 2. Реальные ссылки на контент со страницы источника
    const links = extractContentLinks(indexHtml, PROD_BASE);

    // Если на индексе нет прямых ссылок (источник отдаёт SPA-разметку) —
    // пробуем известные страницы-каталоги того же сайта.
    const candidates = links.length > 0 ? links : [];

    // 3. Параллельный парсинг (каждая страница через вечный кэш)
    const settled = await Promise.allSettled(
      candidates.slice(0, limit).map((url) => scrapeContentCached(url)),
    );

    const items: StreamContent[] = [];
    for (const s of settled) {
      if (s.status === 'fulfilled') items.push(s.value);
    }

    // 4. Сохраняем в вечный файловый архив
    void persistToArchive(items);

    if (items.length === 0) {
      // Ни одной распаршенной карточки — достраиваем ленту из архива
      const archived = await getArchivedItems(limit);
      if (archived.length > 0) {
        return { items: archived, allFailed: false };
      }
      return {
        items: [],
        allFailed: true,
        error: 'Источник доступен, но не вернул ни одной страницы контента.',
      };
    }

    return { items, allFailed: false };
  } catch (e) {
    // Оба сервера упали — сначала пытаемся отдать ВЕЧНЫЙ АРХИВ
    const archived = await getArchivedItems(limit);
    if (archived.length > 0) {
      return { items: archived, allFailed: false };
    }
    return {
      items: [],
      allFailed: true,
      error: (e as Error).message || 'Техническая ошибка источника',
    };
  }
}

/**
 * Поиск: сканирует реальную выдачу источника по query + архив кэшированных
 * когда-либо спаршенных карточек (без моков).
 */
export async function searchFeed(query: string, limit = FEED_LIMIT): Promise<FeedResult> {
  const q = encodeURIComponent(query.trim());
  try {
    const { html } = await fetchPageFailover(`/?s=${q}`);
    const links = extractContentLinks(html, PROD_BASE);
    const settled = await Promise.allSettled(
      links.slice(0, limit).map((url) => scrapeContentCached(url)),
    );
    const items = settled.flatMap((s) => (s.status === 'fulfilled' ? [s.value] : []));
    void persistToArchive(items);
    if (items.length > 0) return { items, allFailed: false };
  } catch {
    /* падаем в архив */
  }

  // Fallback: реальный поиск по вечному локальному архиву
  const lower = query.toLowerCase();
  const archived = (await getArchivedItems(10_000)).filter(
    (i) => i.title.toLowerCase().includes(lower) || i.description.toLowerCase().includes(lower),
  );
  return { items: archived.slice(0, limit), allFailed: false };
}

/** Хэш для стабильных ключей React (используется в API роуте) */
export function hashKey(input: string): string {
  return createHash('sha1').update(input).digest('hex').slice(0, 12);
}


/**
 * Лента видео с обоих зеркал: /videos.php → ссылки video.php?slug=…
 * Failover Prod → Reserve, кэш + архив.
 */
export async function fetchVideosFeed(limit = FEED_LIMIT): Promise<FeedResult> {
  const paths = ['/videos.php', '/videos'];
  try {
    let links: string[] = [];
    let lastErr = '';
    for (const path of paths) {
      try {
        const { html } = await fetchPageFailover(path);
        // только video.php?slug=
        links = extractVideoLinks(html, PROD_BASE).filter((u) => /video\.php/i.test(u) && !/videos\.php/i.test(u));
        if (links.length > 0) break;
      } catch (e) {
        lastErr = (e as Error).message;
      }
    }

    // дедуп
    links = Array.from(new Set(links));

    if (links.length === 0) {
      const archived = (await getArchivedItems(10_000)).filter((i) => i.kind === 'video');
      if (archived.length > 0) return { items: archived.slice(0, limit), allFailed: false };
      return { items: [], allFailed: true, error: lastErr || 'На /videos.php нет ссылок video.php' };
    }

    const settled = await Promise.allSettled(
      links.slice(0, limit).map((url) => scrapeContentCached(url)),
    );
    const items = settled
      .flatMap((s) => (s.status === 'fulfilled' ? [s.value] : []))
      .filter((it) => /video\.php/i.test(it.sourceUrl) || it.kind === 'video')
      .map((it) => ({ ...it, kind: 'video' as const }));

    void persistToArchive(items);

    if (items.length === 0) {
      const archived = (await getArchivedItems(10_000)).filter((i) => i.kind === 'video');
      if (archived.length > 0) return { items: archived.slice(0, limit), allFailed: false };
      return { items: [], allFailed: true, error: 'Не удалось распарсить video.php карточки' };
    }
    return { items, allFailed: false };
  } catch (e) {
    const archived = (await getArchivedItems(10_000)).filter((i) => i.kind === 'video');
    if (archived.length > 0) return { items: archived.slice(0, limit), allFailed: false };
    return { items: [], allFailed: true, error: (e as Error).message };
  }
}
