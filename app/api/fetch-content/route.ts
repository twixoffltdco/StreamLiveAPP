/**
 * GET  /api/fetch-content?url=...  — парсинг + запись в общий архив
 * POST /api/fetch-content          — то же body: { url }
 * GET  /api/fetch-content?q=...    — поиск по архиву
 * GET  /api/fetch-content          — лента
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchFeed, searchFeed } from '@/lib/fetcher';
import { contentId, persistToArchive } from '@/lib/cache';
import { buildIframeCode, detectKind, mapToEmbed, parseMeta } from '@/lib/parse';
import { fetchWithChallenge } from '@/lib/challenge';
import { SOURCE_BASES, type SourceOrigin } from '@/lib/config';
import type { StreamContent } from '@/lib/types';

export const dynamic = 'force-dynamic';

function originOf(url: string): SourceOrigin {
  try {
    const o = new URL(url).origin;
    for (const s of SOURCE_BASES) {
      if (new URL(s.base).origin === o) return s.origin;
    }
  } catch {
    /* */
  }
  return 'prod';
}

async function scrapeAndArchive(sourceUrl: string): Promise<StreamContent> {
  let html = '';
  let finalUrl = sourceUrl;
  let lastErr: Error | null = null;

  // 1) как прислали
  try {
    const r = await fetchWithChallenge(sourceUrl);
    html = r.html;
    finalUrl = r.finalUrl;
  } catch (e) {
    lastErr = e as Error;
  }

  // 2) тот же path на каждом зеркале
  if (!html) {
    const u = new URL(sourceUrl);
    const path = u.pathname + u.search;
    for (const { base } of SOURCE_BASES) {
      try {
        const r = await fetchWithChallenge(`${base}${path}`);
        html = r.html;
        finalUrl = r.finalUrl;
        sourceUrl = `${base}${path}`;
        break;
      } catch (e) {
        lastErr = e as Error;
      }
    }
  }

  if (!html) {
    throw lastErr || new Error('Не удалось загрузить URL ни с одного зеркала');
  }

  const meta = parseMeta(html);
  const item: StreamContent = {
    id: contentId(sourceUrl),
    title: meta.title || 'Без названия',
    description: meta.description || '',
    image: meta.image,
    sourceUrl,
    embedUrl: mapToEmbed(sourceUrl),
    kind: detectKind(sourceUrl),
    origin: originOf(finalUrl || sourceUrl),
    cachedAt: new Date().toISOString(),
  };

  // В общий архив — чтобы видели все
  await persistToArchive([item]);
  return item;
}

async function handleUrl(url: string) {
  const item = await scrapeAndArchive(url);
  return NextResponse.json({
    ok: true,
    data: item,
    iframe: buildIframeCode(item.embedUrl, item.title),
    saved: true,
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const url = searchParams.get('url');
  const q = searchParams.get('q');

  try {
    if (url) return await handleUrl(url);

    if (q) {
      const feed = await searchFeed(q);
      return NextResponse.json({
        ok: true,
        query: q,
        items: feed.items,
        allFailed: feed.allFailed,
      });
    }

    const feed = await fetchFeed();
    return NextResponse.json({
      ok: true,
      items: feed.items,
      allFailed: feed.allFailed,
      error: feed.error,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 502 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { url?: string };
    const url = (body.url || '').trim();
    if (!url) {
      return NextResponse.json({ ok: false, error: 'Нужен url' }, { status: 400 });
    }
    return await handleUrl(url);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 502 },
    );
  }
}
