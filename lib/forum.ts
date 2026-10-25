/**
 * lib/forum.ts — серверный парсер форума источника StreamLive.
 *
 * 1. FAILOVER: PROD_DOMAIN сначала, при таймауте (>3 сек) / 5xx / сетевой
 *    ошибке — прозрачное переключение на RESERVE_DOMAIN.
 * 2. CHEERIO: список тем и содержимое темы извлекаются и очищаются от
 *    мусора (script/style/form/iframe), остаются читабельный текст и картинки.
 * 3. ВЕЧНЫЙ КЭШ: обе функции обёрнуты в `unstable_cache` с revalidate:false —
 *    заголовки форума и посты сохраняются навсегда, даже если источник умрёт.
 */

import { unstable_cache } from 'next/cache';
import * as cheerio from 'cheerio';
import { PROD_BASE, RESERVE_BASE } from './config';
import { fetchWithChallenge } from './challenge';
import { parseMeta } from './parse';
import type { ForumThread, ForumThreadList } from './types';

// (reserve-origin detection uses RESERVE_BASE directly in fetchAnyUrl)

/** Ошибка обеих источников */
export class ForumSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForumSourceError';
  }
}

interface PageResult {
  html: string;
  origin: 'prod' | 'reserve';
}

/** Запрос одной страницы через AES/PoW-challenge резолвер с failover PROD -> RESERVE */
async function fetchPage(pathname: string): Promise<PageResult> {
  const attempts: Array<{ url: string; origin: 'prod' | 'reserve' }> = [
    { url: `${PROD_BASE}${pathname}`, origin: 'prod' },
    { url: `${RESERVE_BASE}${pathname}`, origin: 'reserve' },
  ];

  let lastError = '';
  for (const attempt of attempts) {
    try {
      const { html } = await fetchWithChallenge(attempt.url);
      return { html, origin: attempt.origin };
    } catch (e) {
      lastError = (e as Error).message;
      console.warn(`[forum] ${attempt.origin} (${attempt.url}) недоступен:`, lastError);
    }
  }
  throw new ForumSourceError(lastError || 'Оба источника форума недоступны');
}

/** Извлекает числовой id темы из href (forum.php?id=12, /topic/12, /forum/12) */
function threadIdFromHref(href: string): string | null {
  const m = href.match(/(?:[?&]id=|\/(?:topic|forum|thread)\/)(\d+)/i);
  return m ? m[1] : null;
}

/** Парсит HTML со списком тем форума: ссылки topic/forum с заголовками */
function parseForumListHtml(html: string): ForumThreadList['threads'] {
  const $ = cheerio.load(html);
  const seen = new Map<string, { title: string; href: string }>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (!/(forum|topic|thread)/i.test(href)) return;
    const id = threadIdFromHref(href);
    const title = $(el).text().replace(/\s+/g, ' ').trim();
    if (!id || !title || title.length < 3) return;
    if (!seen.has(id)) seen.set(id, { title, href });
  });

  return Array.from(seen.entries()).map(([id, t]) => ({
    id,
    title: t.title,
    href: new URL(t.href, PROD_BASE).toString(),
  }));
}

/** Живой парсинг списка тем (несколько вероятных путей реального форума) */
async function scrapeForumList(): Promise<ForumThreadList> {
  const candidates = ['/forum', '/forum.php', '/topics', '/index.php', '/'];
  let lastError = '';

  for (const path of candidates) {
    try {
      const { html, origin } = await fetchPage(path);
      const threads = parseForumListHtml(html);
      if (threads.length > 0) {
        return { threads, origin, allFailed: false };
      }
    } catch (e) {
      lastError = (e as Error).message;
    }
  }

  return {
    threads: [],
    origin: 'prod',
    allFailed: true,
    error: lastError || 'Форум не вернул ни одной темы',
  };
}

/** Список тем форума, закешированный НАВСЕГДА (unstable_cache, revalidate:false) */
export const fetchForumList: () => Promise<ForumThreadList> = unstable_cache(
  scrapeForumList,
  ['streamlive-forum-list'],
  { revalidate: false, tags: ['streamlive-forum'] },
);

/**
 * Живой парсинг конкретной темы: Cheerio-санитайзинг убирает скрипты,
 * стили, формы и iframe; оставляет читабельный текст и изображения
 * (относительные src картинок приводятся к абсолютным URL источника).
 */
async function scrapeForumThread(id: string): Promise<ForumThread | null> {
  const safeId = id.replace(/[^\d]/g, '');
  if (!safeId) return null;

  const candidates = [
    `/forum.php?id=${safeId}`,
    `/topic/${safeId}`,
    `/forum/${safeId}`,
    `/viewtopic.php?id=${safeId}`,
  ];

  for (const path of candidates) {
    try {
      const { html, origin } = await fetchPage(path);
      const meta = parseMeta(html);
      if (!meta.title) continue;

      const $ = cheerio.load(html);

      // Санитайзинг: выбрасываем всё исполняемое и шаблонный мусор
      $('script, style, noscript, iframe, object, embed, form, nav, footer, header, link').remove();

      // Ищем контейнер posts у типовых форумных разметок
      const selectors = [
        '.postbody', '.post_body', '.message-body', '.topic-content',
        '.forum-topic', 'article', '#maincontent', 'main', '.content',
      ];
      let $body = $('body');
      for (const sel of selectors) {
        if ($(sel).length > 0) {
          $body = $(sel).first();
          break;
        }
      }

      // Изображения оставляем, приводя относительные src к абсолютным
      $body.find('img[src]').each((_, el) => {
        const src = $(el).attr('src') ?? '';
        try {
          $(el).attr('src', new URL(src, PROD_BASE).toString());
        } catch {
          $(el).removeAttr('src');
        }
      });

      // Ссылки превращаем в текст: из парсенного HTML нельзя ходить по ссылкам
      $body.find('a[href]').each((_, el) => {
        $(el).replaceWith($(el).contents());
      });

      const postsHtml = ($body.html() ?? '').trim();
      const plainText = $body
        .text()
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (plainText.length < 20 && postsHtml.length < 40) continue;

      return {
        id: safeId,
        title: meta.title,
        description: meta.description,
        image: meta.image,
        postsHtml,
        plainText,
        sourceUrl: `${PROD_BASE}${path}`,
        origin,
        cachedAt: new Date().toISOString(),
      };
    } catch {
      /* пробуем следующий путь */
    }
  }

  return null;
}

/** Тема форума, закешированная НАВСЕГДА (unstable_cache, revalidate:false) */
export const fetchForumThread: (id: string) => Promise<ForumThread | null> = unstable_cache(
  scrapeForumThread,
  ['streamlive-forum-thread'],
  { revalidate: false, tags: ['streamlive-forum'] },
);
