import type { MetadataRoute } from 'next';
import { contentId, getArchivedItems } from '@/lib/cache';
import { PROD_BASE, RESERVE_BASE } from '@/lib/config';
import { extractContentLinks, extractVideoLinks } from '@/lib/parse';

async function safeFetch(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; StreamLiveBot/1.0; +https://streamlive.layero.dev)',
      },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://streamlive.layero.dev';
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/videos`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/search`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${base}/forum`, changeFrequency: 'hourly', priority: 0.8 },
  ];

  const seen = new Set<string>();
  const dynamic: MetadataRoute.Sitemap = [];

  const pushItem = (sourceUrl: string, kind: 'channel' | 'video') => {
    const id = contentId(sourceUrl);
    const path = `${base}/watch/${id}`;
    if (seen.has(path)) return;
    seen.add(path);
    dynamic.push({
      url: path,
      changeFrequency: 'daily',
      priority: kind === 'video' ? 0.7 : 0.8,
    });
  };

  try {
    const items = await getArchivedItems(1000);
    for (const item of items) {
      const path = `${base}/watch/${item.id}`;
      if (seen.has(path)) continue;
      seen.add(path);
      dynamic.push({
        url: path,
        lastModified: item.cachedAt ? new Date(item.cachedAt) : new Date(),
        changeFrequency: 'daily',
        priority: item.kind === 'video' ? 0.7 : 0.8,
      });
    }
  } catch {
    /* empty */
  }

  for (const origin of [PROD_BASE, RESERVE_BASE]) {
    const indexHtml = await safeFetch(`${origin}/`);
    if (indexHtml) {
      for (const link of extractContentLinks(indexHtml, origin).slice(0, 80)) {
        pushItem(link, 'channel');
      }
    }
    const videosHtml = await safeFetch(`${origin}/videos.php`);
    if (videosHtml) {
      for (const link of extractVideoLinks(videosHtml, origin).slice(0, 80)) {
        pushItem(link, 'video');
      }
    }
  }

  for (let i = 1; i <= 15; i++) {
    const path = `${base}/forum/${i}`;
    if (!seen.has(path)) {
      seen.add(path);
      dynamic.push({ url: path, changeFrequency: 'daily', priority: 0.5 });
    }
  }

  return [...staticRoutes, ...dynamic];
}
