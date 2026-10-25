import type { MetadataRoute } from 'next';
import { getArchivedItems } from '@/lib/cache';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://streamlive.layero.dev';
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/videos`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/search`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${base}/forum`, changeFrequency: 'hourly', priority: 0.8 },
  ];

  let dynamic: MetadataRoute.Sitemap = [];
  try {
    const items = await getArchivedItems(500);
    dynamic = items.map((item) => ({
      url: `${base}/watch/${item.id}`,
      lastModified: item.cachedAt ? new Date(item.cachedAt) : new Date(),
      changeFrequency: 'daily' as const,
      priority: item.kind === 'video' ? 0.7 : 0.8,
    }));
  } catch {
    /* archive empty */
  }

  return [...staticRoutes, ...dynamic];
}
