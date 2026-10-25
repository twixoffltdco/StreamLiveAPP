/**
 * lib/parse.ts — умный парсинг HTML.
 * Извлекает title / description / og:image и endpoint-маппинг в embed.php?slug=…&cinema=0
 * (как в оригинальном PHP embed.php: raw-плеер без cinema-лендинга).
 */

import * as cheerio from 'cheerio';
import type { ContentKind } from './types';

const TITLE_SUFFIXES = ['— Смотрим', '- Смотрим', '– Смотрим', '| Смотрим'];

export interface ParsedMeta {
  title: string;
  description: string;
  image: string | null;
}

export function cleanTitle(raw: string): string {
  let t = raw.trim();
  for (const suffix of TITLE_SUFFIXES) {
    if (t.endsWith(suffix)) t = t.slice(0, -suffix.length).trim();
  }
  return t;
}

export function parseMeta(html: string): ParsedMeta {
  const $ = cheerio.load(html);

  let title = cleanTitle($('title').first().text() || '');
  if (!title) {
    const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    title = m ? cleanTitle(m[1]) : '';
  }

  let description = ($('meta[name="description"]').attr('content') ?? '').trim();
  if (!description) {
    const m = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
    description = m ? m[1].trim() : '';
  }

  let image = ($('meta[property="og:image"]').attr('content') ?? '').trim();
  if (!image) {
    const m = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']*)["']/i);
    image = m ? m[1].trim() : '';
  }

  return { title, description, image: image || null };
}

export function detectKind(url: string): ContentKind {
  if (/video\.php|embed_video\.php/i.test(url)) return 'video';
  return 'channel';
}

/**
 * Достаёт slug канала из любого URL источника:
 *   /channel.php?slug=foo
 *   /channel-pc.php?slug=foo
 *   /embed.php?slug=foo
 *   /foo (path slug)
 *   ?slug=foo
 */
export function extractSlug(sourceUrl: string): string | null {
  try {
    const u = new URL(sourceUrl);
    const fromQuery = u.searchParams.get('slug');
    if (fromQuery && fromQuery.trim()) return fromQuery.trim();

    // /channel/foo или /embed/foo
    const m = u.pathname.match(/\/(?:channel|channel-pc|embed|watch)\/([^/?#]+)/i);
    if (m?.[1]) return decodeURIComponent(m[1]);

    // иногда slug лежит в path после последнего /
    const parts = u.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && !/\.php$/i.test(last) && last.length > 1) {
      return decodeURIComponent(last);
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * ЭНДПОИНТ-МАППИНГ (как в PHP embed.php):
 *   любой channel/video URL → /embed.php?slug=SLUG&cinema=0
 *
 * cinema=0 / raw=1 — чистый плеер (Playerjs / HLS / iframe VK|YouTube|Twitch),
 * без cinema-лендинга. Иначе в iframe прилетает обёртка и «не тот» плеер.
 */
export function mapToEmbed(sourceUrl: string): string {
  try {
    const u = new URL(sourceUrl);
    const origin = u.origin;
    const slug = extractSlug(sourceUrl);
    const kind = detectKind(sourceUrl);

    // ВИДЕО → embed_video.php?slug=… (PHP VOD)
    if (kind === 'video') {
      if (slug) return `${origin}/embed_video.php?slug=${encodeURIComponent(slug)}`;
      if (/video\.php/i.test(u.pathname)) {
        u.pathname = u.pathname.replace(/video\.php/i, 'embed_video.php');
        return u.toString();
      }
      return sourceUrl;
    }

    // КАНАЛ → всегда embed.php?slug=…&cinema=0 (не catalog, не cinema-лендинг)
    if (slug) {
      return `${origin}/embed.php?slug=${encodeURIComponent(slug)}&cinema=0`;
    }
    if (/(channel|channel-pc)\.php/i.test(u.pathname)) {
      u.pathname = u.pathname.replace(/(channel|channel-pc)\.php/i, 'embed.php');
      u.searchParams.set('cinema', '0');
      // убираем мусорные query кроме slug если был
      return u.toString();
    }
    if (/embed\.php/i.test(u.pathname)) {
      u.searchParams.set('cinema', '0');
      return u.toString();
    }
    return sourceUrl;
  } catch {
    return sourceUrl;
  }
}

export function buildIframeCode(embedUrl: string, title: string): string {
  return `<iframe src="${embedUrl}" title="${title.replace(/"/g, '&quot;')}" frameborder="0" allowfullscreen referrerpolicy="no-referrer" allow="autoplay; encrypted-media; picture-in-picture; fullscreen"></iframe>`;
}

/**
 * Извлекает список ссылок на контент (channel.php / ?slug= / channel-pc.php) из HTML ленты.
 */
export function extractContentLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    // для ленты каналов — только channel.php / channel-pc.php
    if (!/(channel(?:-pc)?\.php)/i.test(href) && !/[?&]slug=/i.test(href)) return;
    if (/video\.php|videos\.php|forum|catalog/i.test(href)) return;
    try {
      const abs = new URL(href, baseUrl).toString();
      if (/embed\.php/i.test(abs)) return;
      if (/video\.php/i.test(abs)) return;
      // нормализуем к channel.php?slug=
      const slug = extractSlug(abs);
      if (slug) {
        const origin = new URL(abs).origin;
        links.add(`${origin}/channel.php?slug=${encodeURIComponent(slug)}`);
      } else {
        links.add(abs);
      }
    } catch {
      /* skip */
    }
  });

  if (links.size === 0) {
    const re = /channel(?:-pc)?\.php\?[A-Za-z0-9_=&%.\-]+/gi;
    for (const m of html.match(re) ?? []) {
      try {
        const abs = new URL(m, baseUrl).toString();
        const slug = extractSlug(abs);
        if (slug) links.add(`${new URL(abs).origin}/channel.php?slug=${encodeURIComponent(slug)}`);
        else links.add(abs);
      } catch {
        /* noop */
      }
    }
    const slugRe = /[?&]slug=([A-Za-z0-9_\-%]+)/gi;
    let sm: RegExpExecArray | null;
    while ((sm = slugRe.exec(html)) !== null) {
      try {
        links.add(new URL(`/channel.php?slug=${sm[1]}`, baseUrl).toString());
      } catch {
        /* noop */
      }
    }
  }

  return Array.from(links);
}


/**
 * Каноническая страница канала на источнике (не catalog):
 *   /channel.php?slug=SLUG
 */
export function mapToChannelPage(sourceUrl: string): string {
  try {
    const u = new URL(sourceUrl);
    const slug = extractSlug(sourceUrl);
    if (slug) return `${u.origin}/channel.php?slug=${encodeURIComponent(slug)}`;
    // уже channel.php — оставляем
    if (/channel\.php/i.test(u.pathname)) return u.toString();
    return sourceUrl;
  } catch {
    return sourceUrl;
  }
}

/**
 * Каноническая страница видео:
 *   /video.php?slug=SLUG
 */
export function mapToVideoPage(sourceUrl: string): string {
  try {
    const u = new URL(sourceUrl);
    const slug = extractSlug(sourceUrl);
    if (slug && /video/i.test(sourceUrl)) {
      return `${u.origin}/video.php?slug=${encodeURIComponent(slug)}`;
    }
    if (/video\.php/i.test(u.pathname)) return u.toString();
    // query slug on video-ish urls
    const q = u.searchParams.get('slug');
    if (q) return `${u.origin}/video.php?slug=${encodeURIComponent(q)}`;
    return sourceUrl;
  } catch {
    return sourceUrl;
  }
}

/** Ссылки на video.php из HTML (каталог видео /videos.php) */
export function extractVideoLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    // СТРОГО только video.php (не channel, не videos.php, не catalog)
    if (!/video\.php/i.test(href)) return;
    if (/videos\.php|channel\.php|forum|catalog/i.test(href)) return;
    try {
      const abs = new URL(href, baseUrl).toString();
      if (!/video\.php/i.test(abs)) return;
      const slug = extractSlug(abs);
      if (slug) {
        links.add(`${new URL(abs).origin}/video.php?slug=${encodeURIComponent(slug)}`);
      } else {
        links.add(abs);
      }
    } catch {
      /* skip */
    }
  });

  if (links.size === 0) {
    const re = /video\.php\?[^"'\s<>]*slug=[A-Za-z0-9_\-%]+[^"'\s<>]*/gi;
    for (const m of html.match(re) ?? []) {
      try {
        const abs = new URL(m, baseUrl).toString();
        if (/videos\.php/i.test(abs)) continue;
        const slug = extractSlug(abs);
        if (slug) links.add(`${new URL(abs).origin}/video.php?slug=${encodeURIComponent(slug)}`);
        else links.add(abs);
      } catch {
        /* noop */
      }
    }
  }

  return Array.from(links);
}
