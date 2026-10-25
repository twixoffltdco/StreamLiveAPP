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
    const kind = detectKind(sourceUrl);

    if (kind === 'video') {
      // video.php?id=… → embed_video.php?id=… (если так заведено на источнике)
      if (/video\.php/i.test(u.pathname)) {
        u.pathname = u.pathname.replace(/video\.php/i, 'embed_video.php');
        return u.toString();
      }
      return sourceUrl;
    }

    const slug = extractSlug(sourceUrl);
    if (slug) {
      // Рабочий raw-embed как в оригинальном PHP
      return `${origin}/embed.php?slug=${encodeURIComponent(slug)}&cinema=0`;
    }

    // fallback: старое поведение channel.php → embed.php
    if (/(channel|channel-pc)\.php/i.test(u.pathname)) {
      u.pathname = u.pathname.replace(/(channel|channel-pc)\.php/i, 'embed.php');
      u.searchParams.set('cinema', '0');
      return u.toString();
    }

    // уже embed.php — форсируем cinema=0
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
    if (!/(channel|video|embed|slug=)/i.test(href)) return;
    try {
      const abs = new URL(href, baseUrl).toString();
      // предпочитаем страницы канала, не embed
      if (/embed\.php/i.test(abs) && !/channel/i.test(abs)) return;
      links.add(abs);
    } catch {
      /* skip */
    }
  });

  if (links.size === 0) {
    const re = /(?:channel(?:-pc)?|video)\.php\?[A-Za-z0-9_=&%.\-]+/gi;
    for (const m of html.match(re) ?? []) {
      try {
        links.add(new URL(m, baseUrl).toString());
      } catch {
        /* noop */
      }
    }
    // slug-only links
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
    if (!/video\.php/i.test(href)) return;
    try {
      links.add(new URL(href, baseUrl).toString());
    } catch {
      /* skip */
    }
  });

  if (links.size === 0) {
    const re = /video\.php\?[A-Za-z0-9_=&%.\-]+/gi;
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
