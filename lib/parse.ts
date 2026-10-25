/**
 * lib/parse.ts — умный парсинг HTML (аналог PHP file_get_contents + regex).
 * Извлекает title / description / og:image и выполняет endpoint-маппинг:
 *   channel.php -> embed.php, video.php -> embed_video.php.
 */

import * as cheerio from 'cheerio';
import type { ContentKind } from './types';

/** Суффиксы, очищаемые из <title> (как в исходном PHP-скрипте) */
const TITLE_SUFFIXES = ['— Смотрим', '- Смотрим', '– Смотрим', '| Смотрим'];

export interface ParsedMeta {
  title: string;
  description: string;
  image: string | null;
}

/** Очистка заголовка от "— Смотрим" и лишних пробелов */
export function cleanTitle(raw: string): string {
  let t = raw.trim();
  for (const suffix of TITLE_SUFFIXES) {
    if (t.endsWith(suffix)) t = t.slice(0, -suffix.length).trim();
  }
  return t;
}

/**
 * Парсит HTML через Cheerio: title, meta[description], meta[og:image].
 * Fallback на regex, если Cheerio не находит тег (кривая разметка источника).
 */
export function parseMeta(html: string): ParsedMeta {
  const $ = cheerio.load(html);

  // 1. <title> с очисткой
  let title = cleanTitle($('title').first().text() || '');
  if (!title) {
    const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    title = m ? cleanTitle(m[1]) : '';
  }

  // 2. meta[name="description"]
  let description = ($('meta[name="description"]').attr('content') ?? '').trim();
  if (!description) {
    const m = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
    description = m ? m[1].trim() : '';
  }

  // 3. meta[property="og:image"]
  let image = ($('meta[property="og:image"]').attr('content') ?? '').trim();
  if (!image) {
    const m = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']*)["']/i);
    image = m ? m[1].trim() : '';
  }

  return { title, description, image: image || null };
}

/** Определяет тип страницы по URL источника */
export function detectKind(url: string): ContentKind {
  if (/video\.php/i.test(url)) return 'video';
  return 'channel';
}

/**
 * ЭНДПОИНТ-МАППИНГ:
 *  channel.php?x -> embed.php?x
 *  video.php?x   -> embed_video.php?x
 * Query-строка сохраняется полностью.
 */
export function mapToEmbed(sourceUrl: string): string {
  const kind = detectKind(sourceUrl);
  const target = kind === 'video' ? 'embed_video.php' : 'embed.php';
  return sourceUrl.replace(/(channel|video)\.php/i, target);
}

/** Формирует чистый iframe-код для карточки */
export function buildIframeCode(embedUrl: string, title: string): string {
  return `<iframe src="${embedUrl}" title="${title.replace(/"/g, '&quot;')}" frameborder="0" allowfullscreen></iframe>`;
}

/**
 * Извлекает список ссылок на контент (channel.php/video.php) из HTML ленты.
 * Возвращает абсолютные URL без дублей.
 */
export function extractContentLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (/(channel|video)\.php/i.test(href)) {
      try {
        links.add(new URL(href, baseUrl).toString());
      } catch {
        /* невалидный URL — пропускаем */
      }
    }
  });

  // Fallback-regex, если разметка кривая
  if (links.size === 0) {
    const re = /(?:channel|video)\.php\?[A-Za-z0-9_=&%.\-]+/gi;
    for (const m of html.match(re) ?? []) {
      try {
        links.add(new URL(m, baseUrl).toString());
      } catch {
        /* noop */
      }
    }
  }

  return Array.from(links);
}
