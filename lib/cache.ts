/**
 * lib/cache.ts — вечная копия на агрегаторе.
 *
 * data/archive.json (+ /tmp fallback) — каналы и видео
 * data/forum-archive.json — заголовки тем/категорий форума
 * memory — быстрый снимок
 *
 * Поиск работает по этим копиям → InfinityFree не долбим.
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

const FORUM_ARCHIVE_CANDIDATES = [
  path.join(process.cwd(), 'data', 'forum-archive.json'),
  path.join('/tmp', 'streamlive-forum-archive.json'),
];

export type ForumArchiveEntry = {
  id: string;
  title: string;
  href: string;
  kind: 'category' | 'thread';
  cachedAt: string;
};

let memoryArchive: Record<string, StreamContent> = {};
let memoryForum: Record<string, ForumArchiveEntry> = {};
let memoryFeedAt = 0;
let memoryFeedItems: StreamContent[] = [];

export function contentId(sourceUrl: string): string {
  return createHash('md5').update(sourceUrl).digest('hex').slice(0, 16);
}

async function tryReadJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function tryWriteJson(file: string, data: unknown): Promise<boolean> {
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(data), 'utf8');
    await fs.rename(tmp, file);
    return true;
  } catch {
    return false;
  }
}

async function readArchive(): Promise<Record<string, StreamContent>> {
  if (Object.keys(memoryArchive).length > 0) {
    for (const file of ARCHIVE_CANDIDATES) {
      const disk = await tryReadJson<Record<string, StreamContent>>(file);
      if (disk) {
        memoryArchive = { ...disk, ...memoryArchive };
        break;
      }
    }
    return { ...memoryArchive };
  }
  for (const file of ARCHIVE_CANDIDATES) {
    const disk = await tryReadJson<Record<string, StreamContent>>(file);
    if (disk && Object.keys(disk).length > 0) {
      memoryArchive = disk;
      return { ...disk };
    }
  }
  return {};
}

async function writeContentArchive(items: StreamContent[]): Promise<void> {
  const existing = await readArchive();
  for (const item of items) existing[item.id] = item;
  memoryArchive = existing;
  for (const file of ARCHIVE_CANDIDATES) {
    if (await tryWriteJson(file, existing)) break;
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

export async function getArchivedIdSet(): Promise<Set<string>> {
  return new Set(Object.keys(await readArchive()));
}

export async function persistToArchive(items: StreamContent[]): Promise<void> {
  if (!items.length) return;
  try {
    await writeContentArchive(items);
  } catch (e) {
    console.warn('[cache] archive write fail', (e as Error).message);
  }
}

/** —— Форум-архив —— */
async function readForumArchive(): Promise<Record<string, ForumArchiveEntry>> {
  if (Object.keys(memoryForum).length > 0) {
    for (const file of FORUM_ARCHIVE_CANDIDATES) {
      const disk = await tryReadJson<Record<string, ForumArchiveEntry>>(file);
      if (disk) {
        memoryForum = { ...disk, ...memoryForum };
        break;
      }
    }
    return { ...memoryForum };
  }
  for (const file of FORUM_ARCHIVE_CANDIDATES) {
    const disk = await tryReadJson<Record<string, ForumArchiveEntry>>(file);
    if (disk && Object.keys(disk).length > 0) {
      memoryForum = disk;
      return { ...disk };
    }
  }
  return {};
}

export async function persistForumEntries(
  entries: Array<{ id: string; title: string; href: string; kind?: 'category' | 'thread' }>,
): Promise<void> {
  if (!entries.length) return;
  const existing = await readForumArchive();
  const now = new Date().toISOString();
  for (const e of entries) {
    if (!e.id || !e.title) continue;
    existing[`${e.kind ?? 'thread'}:${e.id}`] = {
      id: e.id,
      title: e.title,
      href: e.href,
      kind: e.kind ?? 'thread',
      cachedAt: now,
    };
  }
  memoryForum = existing;
  for (const file of FORUM_ARCHIVE_CANDIDATES) {
    if (await tryWriteJson(file, existing)) break;
  }
}

export async function searchForumArchive(query: string, limit = 30): Promise<ForumArchiveEntry[]> {
  const lower = query.trim().toLowerCase();
  if (!lower) return [];
  const tokens = lower.split(/[\s,.;:+\-_/]+/).filter((t) => t.length >= 2);
  const all = Object.values(await readForumArchive());
  return all
    .filter((e) => {
      const hay = `${e.title} ${e.href}`.toLowerCase();
      if (hay.includes(lower)) return true;
      if (tokens.length > 1 && tokens.every((t) => hay.includes(t))) return true;
      if (tokens.length === 1 && hay.includes(tokens[0])) return true;
      return false;
    })
    .slice(0, limit);
}

export function getMemoryFeed(maxAgeSec: number): StreamContent[] | null {
  if (!memoryFeedItems.length) return null;
  if (Date.now() - memoryFeedAt > maxAgeSec * 1000) return null;
  return memoryFeedItems;
}

export function setMemoryFeed(items: StreamContent[]): void {
  memoryFeedItems = items;
  memoryFeedAt = Date.now();
}

export function foreverCachePage<T extends { sourceUrl: string }>(
  fn: (sourceUrl: string) => Promise<T>,
) {
  return unstable_cache(fn, ['streamlive-page'], {
    revalidate: false,
    tags: ['streamlive'],
  });
}
