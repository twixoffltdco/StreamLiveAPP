/**
 * lib/archive.ts — чтение вечного файлового архива (data/archive.json)
 * из Client Components через сериализованные props.
 * Отдельно от cache.ts, чтобы не тянуть next/cache в браузер.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { StreamContent } from './types';

const ARCHIVE_FILE = path.join(process.cwd(), 'data', 'archive.json');

/** Читает все когда-либо спаршенные и сохранённые навсегда карточки */
export async function readAllArchived(): Promise<StreamContent[]> {
  try {
    const raw = await fs.readFile(ARCHIVE_FILE, 'utf8');
    return Object.values(JSON.parse(raw) as Record<string, StreamContent>);
  } catch {
    return [];
  }
}
