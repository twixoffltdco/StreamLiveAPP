/**
 * app/api/fetch-content/route.ts — API роут раздачи спаршенного контента.
 *
 * GET /api/fetch-content            -> лента (feed) с Prod/Reserve failover
 * GET /api/fetch-content?url=...    -> метаданные одной страницы + iframe-код
 * GET /api/fetch-content?q=запрос   -> поиск по источнику + вечному архиву
 *
 * Все ответы проходят через unstable_cache (1 год) и файловый архив,
 * поэтому однажды спаршенные данные живут на нашем сайте навсегда.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchFeed, searchFeed } from '@/lib/fetcher';
import { foreverCachePage, contentId } from '@/lib/cache';
import { buildIframeCode, detectKind, mapToEmbed, parseMeta } from '@/lib/parse';
import { fetchWithChallenge } from '@/lib/challenge';
import { PROD_BASE, RESERVE_BASE } from '@/lib/config';
import type { StreamContent } from '@/lib/types';

/** Отдаём JSON всегда свежим на уровне CDN (кэш живёт внутри unstable_cache) */
export const dynamic = 'force-dynamic';

/** Парсинг одной произвольной страницы источника (channel/video.php) с вечным кэшем */
async function scrapeSingle(sourceUrl: string): Promise<StreamContent> {
  let html: string;
  try {
    ({ html } = await fetchWithChallenge(sourceUrl));
  } catch {
    // Failover: подменяем origin на резервный
    const reserveUrl = sourceUrl.replace(PROD_BASE, RESERVE_BASE);
    ({ html } = await fetchWithChallenge(reserveUrl));
  }

  const meta = parseMeta(html);
  return {
    id: contentId(sourceUrl),
    title: meta.title || 'Без названия',
    description: meta.description || '',
    image: meta.image,
    sourceUrl,
    embedUrl: mapToEmbed(sourceUrl),
    kind: detectKind(sourceUrl),
    origin: sourceUrl.includes(PROD_BASE) ? 'prod' : 'reserve',
    cachedAt: new Date().toISOString(),
  };
}

const scrapeSingleCached = foreverCachePage(scrapeSingle);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const url = searchParams.get('url');
  const q = searchParams.get('q');

  try {
    // 1. Одна страница по URL -> метаданные + чистый iframe-код
    if (url) {
      const item = await scrapeSingleCached(url);
      return NextResponse.json({
        ok: true,
        data: item,
        iframe: buildIframeCode(item.embedUrl, item.title),
      });
    }

    // 2. Поиск
    if (q) {
      const feed = await searchFeed(q);
      return NextResponse.json({ ok: true, query: q, items: feed.items, allFailed: feed.allFailed });
    }

    // 3. Лента по умолчанию
    const feed = await fetchFeed();
    return NextResponse.json({ ok: !feed.allFailed, items: feed.items, error: feed.error });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message ?? 'Unknown error' },
      { status: 502 },
    );
  }
}
