/**
 * lib/fetcher.ts — серверный фетчер агрегатора StreamLive.
 *
 * Стратегия (чтобы InfinityFree не лёг):
 *  1. Сначала отдаём ВЕЧНЫЙ АРХИВ / memory-снимок.
 *  2. Не чаще FEED_REFRESH_SEC ходим на PHP за списком ссылок.
 *  3. Парсим только НОВЫЕ slug (нет в архиве), макс MAX_NEW_SCRAPE_PER_RUN,
 *     с паузой SCRAPE_DELAY_MS между запросами.
 *  4. Старые карточки живут в копии навсегда, даже если PHP мёртв.
 */

import { createHash } from 'crypto';
import {
  FEED_LIMIT,
  FEED_REFRESH_SEC,
  MAX_NEW_SCRAPE_PER_RUN,
  PROD_BASE,
  SCRAPE_DELAY_MS,
  SOURCE_BASES,
  type SourceOrigin,
} from './config';
import { fetchWithChallenge } from './challenge';
import { detectKind, extractContentLinks, extractVideoLinks, mapToEmbed, parseMeta } from './parse';
import {
  contentId,
  foreverCachePage,
  getArchivedIdSet,
  getArchivedItems,
  getMemoryFeed,
  persistToArchive,
  searchForumArchive,
  setMemoryFeed,
} from './cache';
import type { ForumArchiveEntry } from './cache';
import type { FeedResult, StreamContent } from './types';

class SourceError extends Error {
  recoverable: boolean;
  constructor(message: string, recoverable = true) {
    super(message);
    this.recoverable = recoverable;
  }
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPageFailover(
  pathname: string,
): Promise<{ html: string; origin: SourceOrigin; finalUrl: string }> {
  let lastError: Error | null = null;
  for (const { base, origin } of SOURCE_BASES) {
    try {
      const { html, finalUrl } = await fetchWithChallenge(`${base}${pathname}`);
      return { html, origin, finalUrl };
    } catch (e) {
      lastError = e as Error;
      console.warn(`[fetcher] ${origin} недоступен:`, lastError.message);
    }
  }
  throw new SourceError(lastError?.message ?? 'Все источники недоступны');
}

async function scrapeContent(sourceUrl: string): Promise<StreamContent> {
  const u = new URL(sourceUrl);
  const { html, origin } = await fetchPageFailover(u.pathname + u.search);
  const meta = parseMeta(html);
  if (!meta.title) {
    throw new SourceError(`Нет <title> у ${sourceUrl}`, false);
  }
  return {
    id: contentId(sourceUrl),
    title: meta.title,
    description: meta.description || 'Без описания — смотрите в плеере.',
    image: meta.image,
    sourceUrl,
    embedUrl: mapToEmbed(sourceUrl),
    kind: detectKind(sourceUrl),
    origin,
    cachedAt: new Date().toISOString(),
  };
}

const scrapeContentCached = foreverCachePage(scrapeContent);

/** Последовательный парсе только новых URL */
async function scrapeNewOnly(links: string[], knownIds: Set<string>): Promise<StreamContent[]> {
  const fresh: string[] = [];
  for (const url of links) {
    const id = contentId(url);
    if (!knownIds.has(id)) fresh.push(url);
  }

  const toFetch = fresh.slice(0, MAX_NEW_SCRAPE_PER_RUN);
  const out: StreamContent[] = [];

  for (let i = 0; i < toFetch.length; i++) {
    try {
      const item = await scrapeContentCached(toFetch[i]);
      out.push(item);
      knownIds.add(item.id);
    } catch (e) {
      console.warn('[fetcher] scrape fail', toFetch[i], (e as Error).message);
    }
    if (i < toFetch.length - 1) await sleep(SCRAPE_DELAY_MS);
  }
  return out;
}

function mergeById(primary: StreamContent[], secondary: StreamContent[]): StreamContent[] {
  const map = new Map<string, StreamContent>();
  for (const it of secondary) map.set(it.id, it);
  for (const it of primary) map.set(it.id, it); // primary wins
  return Array.from(map.values()).sort((a, b) => (a.cachedAt < b.cachedAt ? 1 : -1));
}

/**
 * Лента каналов: архив-first, редкий soft-refresh с PHP.
 */
export async function fetchFeed(limit = FEED_LIMIT): Promise<FeedResult> {
  // 1) Быстрый memory-снимок (без PHP)
  const mem = getMemoryFeed(FEED_REFRESH_SEC);
  if (mem && mem.length > 0) {
    return { items: mem.slice(0, limit), allFailed: false };
  }

  // 2) Вечный архив
  const archived = await getArchivedItems(Math.max(limit * 3, 50));
  const known = await getArchivedIdSet();

  // 3) Редкий запрос списка ссылок на PHP
  try {
    const { html: indexHtml } = await fetchPageFailover('/');
    const links = extractContentLinks(indexHtml, PROD_BASE);

    const newly = await scrapeNewOnly(links, known);
    if (newly.length) void persistToArchive(newly);

    // карточки по известным ссылкам — из архива / кэша (без лишних хитов)
    const fromArchive: StreamContent[] = [];
    const archMap = new Map((await getArchivedItems(5000)).map((i) => [i.id, i]));
    for (const url of links) {
      const id = contentId(url);
      const hit = archMap.get(id);
      if (hit) fromArchive.push(hit);
    }

    const merged = mergeById(newly, fromArchive.length ? fromArchive : archived).slice(0, limit);
    if (merged.length) {
      setMemoryFeed(merged);
      void persistToArchive(merged);
      return { items: merged, allFailed: false };
    }
  } catch (e) {
    console.warn('[fetcher] refresh fail, archive only:', (e as Error).message);
  }

  if (archived.length > 0) {
    setMemoryFeed(archived.slice(0, limit));
    return { items: archived.slice(0, limit), allFailed: false };
  }

  return {
    items: [],
    allFailed: true,
    error: 'Нет архива и источники недоступны',
  };
}

/**
 * Раздел видео (VOD + стримы с /videos.php) — та же схема.
 */
export async function fetchVideosFeed(limit = FEED_LIMIT): Promise<FeedResult> {
  const memKey = getMemoryFeed(FEED_REFRESH_SEC);
  // memory общий — для videos лучше всегда пробовать архив+soft

  const archivedAll = await getArchivedItems(5000);
  const archived = archivedAll.slice(0, limit * 2);
  const known = await getArchivedIdSet();

  try {
    let links: string[] = [];
    for (const path of ['/videos.php', '/videos']) {
      try {
        const { html } = await fetchPageFailover(path);
        links = Array.from(
          new Set([...extractVideoLinks(html, PROD_BASE), ...extractContentLinks(html, PROD_BASE)]),
        );
        if (links.length) break;
      } catch {
        /* next */
      }
    }

    const newly = await scrapeNewOnly(links, known);
    if (newly.length) void persistToArchive(newly);

    const archMap = new Map(archivedAll.map((i) => [i.id, i]));
    const fromArchive: StreamContent[] = [];
    for (const url of links) {
      const hit = archMap.get(contentId(url));
      if (hit) fromArchive.push(hit);
    }

    const merged = mergeById(newly, fromArchive.length ? fromArchive : archived).slice(0, limit);
    if (merged.length) {
      void persistToArchive(merged);
      return { items: merged, allFailed: false };
    }
  } catch (e) {
    console.warn('[fetcher] videos refresh fail:', (e as Error).message);
  }

  if (archived.length > 0) return { items: archived.slice(0, limit), allFailed: false };
  return { items: [], allFailed: true, error: 'Видео: нет архива и источники недоступны' };
}

/**
 * Поиск: только по архиву + мягкий refresh лент (без шторма запросов).
 */
export type SearchResult = {
  channels: StreamContent[];
  videos: StreamContent[];
  forum: ForumArchiveEntry[];
};

/** Универсальный поиск ТОЛЬКО по локальным копиям (каналы, видео, форум). Без PHP. */
export async function searchAll(query: string, limit = FEED_LIMIT): Promise<SearchResult> {
  const raw = query.trim();
  if (!raw) return { channels: [], videos: [], forum: [] };

  const lower = raw.toLowerCase();
  const tokens = lower.split(/[\s,.;:+\-_/]+/).filter((t) => t.length >= 2);

  const matches = (it: StreamContent): boolean => {
    const hay = `${it.title} ${it.description} ${it.sourceUrl}`.toLowerCase();
    if (hay.includes(lower)) return true;
    if (tokens.length > 1 && tokens.every((tok) => hay.includes(tok))) return true;
    if (tokens.length === 1 && hay.includes(tokens[0])) return true;
    return false;
  };

  const archived = await getArchivedItems(10_000);
  const channels = archived.filter((i) => i.kind !== 'video' && matches(i)).slice(0, limit);
  const videos = archived.filter((i) => i.kind === 'video' && matches(i)).slice(0, limit);
  const forum = await searchForumArchive(raw, limit);

  return { channels, videos, forum };
}

/** Совместимость: плоский список каналов+видео из архива */
export async function searchFeed(query: string, limit = FEED_LIMIT): Promise<FeedResult> {
  const r = await searchAll(query, limit);
  const items = [...r.channels, ...r.videos].slice(0, limit);
  return { items, allFailed: false };
}

export function hashKey(input: string): string {
  return createHash('sha1').update(input).digest('hex').slice(0, 12);
}
