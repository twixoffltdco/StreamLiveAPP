/**
 * lib/cache.ts — вечная копия спаршенных данных на агрегаторе.
 *
 * Куда сохраняется:
 *   1) data/archive.json     — диск проекта (если writable)
 *   2) /tmp/streamlive-archive.json — fallback, если data/ read-only (Layero/Docker)
 *   3) unstable_cache Next   — мета каждой страницы навсегда (revalidate: false)
 *   4) memory (process)      — снимок ленты между запросами одного инстанса
 *
 * Даже если PHP/InfinityFree лежит — отдаём архив.
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { unstable_cache } from 'next/cache';
import type { StreamContent } from './types';

const ARCHIVE_CANDIDATES = [
  path.join(process.cwd(), 'data', 'archive.json'),
  path.join('/tmp', 'streamlive-archive.json'),
];

/** In-memory mirror (живёт, пока жив процесс Node) */
let memoryArchive: Record<string, StreamContent> = {};
let memoryFeedAt = 0;
let memoryFeedItems: StreamContent[] = [];

/** Стабильный id карточки = md5 от исходного URL */
export function contentId(sourceUrl: string): string {
  return createHash('md5').update(sourceUrl).digest('hex').slice(0, 16);
}

async function tryReadFile(file: string): Promise<Record<string, StreamContent> | null> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as Record<string, StreamContent>;
  } catch {
    return null;
  }
}

/** Читает архив: memory → data/ → /tmp/ */
async function readArchive(): Promise<Record<string, StreamContent>> {
  if (Object.keys(memoryArchive).length > 0) {
    // подмешиваем диск, если там больше записей
    for (const file of ARCHIVE_CANDIDATES) {
      const disk = await tryReadFile(file);
      if (disk) {
        memoryArchive = { ...disk, ...memoryArchive };
        break;
      }
    }
    return { ...memoryArchive };
  }

  for (const file of ARCHIVE_CANDIDATES) {
    const disk = await tryReadFile(file);
    if (disk && Object.keys(disk).length > 0) {
      memoryArchive = disk;
      return { ...disk };
    }
  }
  return {};
}

async function writeArchive(items: StreamContent[]): Promise<void> {
  const existing = await readArchive();
  for (const item of items) existing[item.id] = item;
  memoryArchive = existing;

  const payload = JSON.stringify(existing);
  let written = false;
  for (const file of ARCHIVE_CANDIDATES) {
    try {
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = file + '.tmp';
      await fs.writeFile(tmp, payload, 'utf8');
      await fs.rename(tmp, file);
      written = true;
      break;
    } catch {
      /* next candidate */
    }
  }
  if (!written) {
    console.warn('[cache] Диск недоступен — архив только в memory + unstable_cache');
  }
}

export async function getArchivedItems(limit: number): Promise<StreamContent[]> {
  const archive = await readArchive();
  return Object.values(archive)
    .sort((a, b) => (a.cachedAt < b.cachedAt ? 1 : -1))
    .slice(0, limit);
}

export async function getArchivedById(id: string): Promise<StreamContent | null> {
  const archive = await readArchive();
  return archive[id] ?? null;
}

/** Все id, которые уже есть в вечной копии */
export async function getArchivedIdSet(): Promise<Set<string>> {
  const archive = await readArchive();
  return new Set(Object.keys(archive));
}

export async function persistToArchive(items: StreamContent[]): Promise<void> {
  if (items.length === 0) return;
  try {
    await writeArchive(items);
  } catch (e) {
    console.warn('[cache] Не удалось записать архив:', (e as Error).message);
  }
}

/** Снимок ленты в memory (чтобы не долбить PHP на каждый F5) */
export function getMemoryFeed(maxAgeSec: number): StreamContent[] | null {
  if (!memoryFeedItems.length) return null;
  if (Date.now() - memoryFeedAt > maxAgeSec * 1000) return null;
  return memoryFeedItems;
}

export function setMemoryFeed(items: StreamContent[]): void {
  memoryFeedItems = items;
  memoryFeedAt = Date.now();
}

/**
 * Мета одной страницы — навсегда в Next cache.
 */
export function foreverCachePage<T extends { sourceUrl: string }>(
  fn: (sourceUrl: string) => Promise<T>,
) {
  return unstable_cache(fn, ['streamlive-page'], {
    revalidate: false,
    tags: ['streamlive'],
  });
}
