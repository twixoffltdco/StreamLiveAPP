import type { Metadata, Viewport } from 'next';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://streamlive.layero.dev';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'StreamLive — смотри всё',
    template: '%s · StreamLive',
  },
  description:
    'Архив живого ТВ и VOD: каналы, видео и форум StreamLive. Парсинг, вечный кэш, SEO-страницы.',
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    url: siteUrl,
    siteName: 'StreamLive',
    title: 'StreamLive — смотри всё',
    description: 'Каналы, видео и форум StreamLive с вечным кэшем.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StreamLive — смотри всё',
    description: 'Каналы, видео и форум StreamLive.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: { canonical: siteUrl },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="bg-black">
      <body className="min-h-dvh bg-black text-white antialiased">{children}</body>
    </html>
  );
}
