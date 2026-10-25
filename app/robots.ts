import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://streamlive.layero.dev';
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/add', '/profile'],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
