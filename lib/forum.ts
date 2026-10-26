/**
 * lib/forum.ts — серверный парсер форума StreamLive.
 *
 * Структура источника (PHP):
 *   /forum.php              → категории (forum_categories)
 *   /forum_category.php?id= → темы в категории (forum_threads)
 *   /forum_thread.php?id=   → посты темы (forum_posts)
 *
 * Раньше id с главной форума принимались за темы — на деле это категории,
 * поэтому /forum/[id] показывал мусор (шапку сайта). Сейчас пути правильные.
 */

import { unstable_cache } from 'next/cache';
import * as cheerio from 'cheerio';
import { PROD_BASE, SOURCE_BASES, type SourceOrigin } from './config';
import { fetchWithChallenge } from './challenge';
import { parseMeta } from './parse';
import type { ForumThread, ForumThreadList } from './types';
import { persistForumEntries } from './cache';

export class ForumSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForumSourceError';
  }
}

interface PageResult {
  html: string;
  origin: SourceOrigin;
}

async function fetchPage(pathname: string): Promise<PageResult> {
  let lastError = '';
  for (const { base, origin } of SOURCE_BASES) {
    try {
      const { html } = await fetchWithChallenge(`${base}${pathname}`);
      return { html, origin };
    } catch (e) {
      lastError = (e as Error).message;
      console.warn(`[forum] ${origin} (${base}${pathname}) недоступен:`, lastError);
    }
  }
  throw new ForumSourceError(lastError || 'Все источники форума недоступны');
}

/** id из forum_category.php?id=12 / forum_thread.php?id=12 / /forum/12 */
function idFromHref(href: string): string | null {
  const m = href.match(/(?:forum_category|forum_thread|forum)\.php\?[^#]*\bid=(\d+)/i)
    || href.match(/\/forum\/(?:category|thread|cat)?\/?(\d+)/i)
    || href.match(/[?&]id=(\d+)/i);
  return m ? m[1] : null;
}

/**
 * Парсит /forum.php — список КАТЕГОРИЙ.
 * Ссылки ведут на forum_category.php?id=N
 */
function parseForumCategoriesHtml(html: string): ForumThreadList['threads'] {
  const $ = cheerio.load(html);
  const seen = new Map<string, { title: string; href: string }>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    // только категории
    if (!/forum_category\.php/i.test(href) && !/\/forum\/(?:category|cat)\//i.test(href)) {
      // на некоторых шаблонах категория — просто forum.php?id=
      if (!/forum\.php\?[^#]*\bid=\d+/i.test(href)) return;
    }
    const id = idFromHref(href);
    let title = $(el).text().replace(/\s+/g, ' ').trim();
    // иногда заголовок в соседнем элементе
    if (!title || title.length < 2) {
      title = $(el).closest('tr, li, .card, .category, article').find('h2, h3, .title, strong').first().text().replace(/\s+/g, ' ').trim();
    }
    if (!id || !title || title.length < 2) return;
    if (!seen.has(id)) {
      try {
        seen.set(id, { title, href: new URL(href, PROD_BASE).toString() });
      } catch {
        seen.set(id, { title, href });
      }
    }
  });

  // fallback: любой id-подобный блок с текстом категории
  if (seen.size === 0) {
    $('a[href*="id="]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      if (!/forum/i.test(href)) return;
      const id = idFromHref(href);
      const title = $(el).text().replace(/\s+/g, ' ').trim();
      if (!id || !title || title.length < 3) return;
      if (!seen.has(id)) {
        try {
          seen.set(id, { title, href: new URL(href, PROD_BASE).toString() });
        } catch {
          seen.set(id, { title, href });
        }
      }
    });
  }

  return Array.from(seen.entries()).map(([id, t]) => ({
    id,
    title: t.title,
    href: t.href,
  }));
}

/**
 * Парсит /forum_category.php?id= — список ТЕМ в категории.
 * Возвращаем в том же формате ForumThreadSummary (id = thread id).
 */
function parseCategoryThreadsHtml(html: string): ForumThreadList['threads'] {
  const $ = cheerio.load(html);
  const seen = new Map<string, { title: string; href: string }>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const isThread =
      /forum_thread\.php/i.test(href) ||
      /\/forum\/thread\//i.test(href) ||
      (/forum\.php\?[^#]*id=\d+/i.test(href) && !/forum_category/i.test(href));
    if (!isThread) return;
    const id = idFromHref(href);
    const title = $(el).text().replace(/\s+/g, ' ').trim();
    if (!id || !title || title.length < 3) return;
    if (!seen.has(id)) {
      try {
        seen.set(id, { title, href: new URL(href, PROD_BASE).toString() });
      } catch {
        seen.set(id, { title, href });
      }
    }
  });

  return Array.from(seen.entries()).map(([id, t]) => ({
    id,
    title: t.title,
    href: t.href,
  }));
}

async function scrapeForumList(): Promise<ForumThreadList> {
  const candidates = ['/forum.php', '/forum', '/forum_whats_new.php'];
  let lastError = '';

  for (const path of candidates) {
    try {
      const { html, origin } = await fetchPage(path);
      const threads = parseForumCategoriesHtml(html);
      if (threads.length > 0) {
        void persistForumEntries(
          threads.map((th) => ({
            id: th.id,
            title: th.title,
            href: th.href,
            kind: 'category' as const,
          })),
        );
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
    error: lastError || 'Форум не вернул ни одной категории',
  };
}

export const fetchForumList: () => Promise<ForumThreadList> = unstable_cache(
  scrapeForumList,
  ['streamlive-forum-list-v2'],
  { revalidate: false, tags: ['streamlive-forum'] },
);

/**
 * /forum/[id] — сначала пробуем как КАТЕГОРИЮ (список тем → склеиваем в postsHtml),
 * потом как ТЕМУ (forum_thread.php).
 */
async function scrapeForumThread(id: string): Promise<ForumThread | null> {
  const safeId = id.replace(/[^\d]/g, '');
  if (!safeId) return null;

  // ТОЛЬКО тема. Категории — fetchCategoryThreads / /forum/c/[id]
  const threadPaths = [
    `/forum_thread.php?id=${safeId}`,
    `/forum.php?thread=${safeId}`,
  ];

  for (const path of threadPaths) {
    try {
      const { html, origin } = await fetchPage(path);
      const meta = parseMeta(html);
      if (!meta.title) continue;

      const $ = cheerio.load(html);
      $('script, style, noscript, iframe, object, embed, form, nav, footer, header, link').remove();

      const postNodes = $('.post, .post-body, .postbody, .forum-post, .message, .comment, article');
      let postsHtml = '';
      let plainText = '';

      if (postNodes.length > 0) {
        const chunks: string[] = [];
        postNodes.each((_, el) => {
          chunks.push($.html(el) ?? '');
        });
        postsHtml = chunks.join('\n').trim();
        plainText = postNodes
          .text()
          .replace(/[ \t]+/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      } else {
        const $body = $('main, .content, #content, body').first();
        $body.find('img[src]').each((_, el) => {
          const src = $(el).attr('src') ?? '';
          try {
            $(el).attr('src', new URL(src, PROD_BASE).toString());
          } catch {
            $(el).removeAttr('src');
          }
        });
        postsHtml = ($body.html() ?? '').trim();
        plainText = $body
          .text()
          .replace(/[ \t]+/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      }

      if (plainText.length < 10 && postsHtml.length < 20) continue;

      void persistForumEntries([
        {
          id: safeId,
          title: meta.title,
          href: `${PROD_BASE}/forum_thread.php?id=${safeId}`,
          kind: 'thread',
        },
      ]);

      return {
        id: safeId,
        title: meta.title,
        description: meta.description,
        image: meta.image,
        postsHtml,
        plainText,
        sourceUrl: `${PROD_BASE}/forum_thread.php?id=${safeId}`,
        origin,
        cachedAt: new Date().toISOString(),
      };
    } catch {
      /* next path */
    }
  }

  return null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const fetchForumThread: (id: string) => Promise<ForumThread | null> = unstable_cache(
  scrapeForumThread,
  ['streamlive-forum-thread-v2'],
  { revalidate: false, tags: ['streamlive-forum'] },
);

/** Темы внутри категории — для /forum/thread/[id] можно дергать отдельно */
export async function fetchCategoryThreads(categoryId: string): Promise<ForumThreadList> {
  const safeId = categoryId.replace(/[^\d]/g, '');
  if (!safeId) {
    return { threads: [], origin: 'prod', allFailed: true, error: 'bad id' };
  }
  try {
    const { html, origin } = await fetchPage(`/forum_category.php?id=${safeId}`);
    const threads = parseCategoryThreadsHtml(html);
    void persistForumEntries(threads.map((th) => ({ id: th.id, title: th.title, href: th.href, kind: 'thread' as const })));
    return { threads, origin, allFailed: threads.length === 0 };
  } catch (e) {
    return {
      threads: [],
      origin: 'prod',
      allFailed: true,
      error: (e as Error).message,
    };
  }
}


/** Поиск по локальному архиву форума (без PHP). */
export async function searchForumLocal(query: string, limit = 30) {
  const { searchForumArchive } = await import('./cache');
  return searchForumArchive(query, limit);
}
