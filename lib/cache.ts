/**
 * lib/cache.ts — вечное кэширование спаршенных данных.
 *
 * Двухуровневая стратегия:
 *  1. Next.js `unstable_cache` (revalidate = 1 год) — метаданные страницы
 *     живут в kV-кэше Next и переживают рестарты на persistent-хостингах.
 *  2. Файловый архив `data/archive.json` — guarantee "навсегда": однажды
 *     спаршенные title/description/image сохраняются на диске и отдаются,
 *     даже если оба сервера-источника умрут окончательно.
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { unstable_cache } from 'next/cache';
import type { StreamContent } from './types';

const ARCHIVE_DIR = path.join(process.cwd(), 'data');
const ARCHIVE_FILE = path.join(ARCHIVE_DIR, 'archive.json');

/** Стабильный id карточки = md5 от исходного URL */
export function contentId(sourceUrl: string): string {
  return createHash('md5').update(sourceUrl).digest('hex').slice(0, 16);
}

/** Читает файловый архив с диска (пустой, если файла ещё нет) */
async function readArchive(): Promise<Record<string, StreamContent>> {
  try {
    const raw = await fs.readFile(ARCHIVE_FILE, 'utf8');
    return JSON.parse(raw) as Record<string, StreamContent>;
  } catch {
    return {};
  }
}

/** Писатель архива: атомарная перезапись + merge */
async function writeArchive(items: StreamContent[]): Promise<void> {
  const existing = await readArchive();
  for (const item of items) existing[item.id] = item;
  await fs.mkdir(ARCHIVE_DIR, { recursive: true });
  const tmp = ARCHIVE_FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(existing, null, 2), 'utf8');
  await fs.rename(tmp, ARCHIVE_FILE);
}

/**
 * Архивные fallback-данные: если живой парсинг не удался,
 * лента достраивается из того, что уже было сохранено навсегда.
 */
export async function getArchivedItems(limit: number): Promise<StreamContent[]> {
  const archive = await readArchive();
  return Object.values(archive)
    .sort((a, b) => (a.cachedAt < b.cachedAt ? 1 : -1))
    .slice(0, limit);
}

/** Сохраняет успешно спаршенное в вечный архив */
export async function persistToArchive(items: StreamContent[]): Promise<void> {
  if (items.length === 0) return;
  try {
    await writeArchive(items);
  } catch (e) {
    // На read-only FS (например Vercel serverless) файловый уровень недоступен —
    // остаётся только unstable_cache, это не критично.
    console.warn('[cache] Не удалось записать архив:', (e as Error).message);
  }
}

/**
 * Публичная обёртка unstable_cache: кэш одного контента по его URL.
 * revalidate: false — однажды спаршенные метаданные (title, description,
 * og:image) сохраняются в Next.js НАВСЕГДА, даже если источник умрёт.
 */
export function foreverCachePage<T extends { sourceUrl: string }>(
  fn: (sourceUrl: string) => Promise<T>,
) {
  return unstable_cache(fn, ['streamlive-page'], {
    revalidate: false,
    tags: ['streamlive'],
  });
}
