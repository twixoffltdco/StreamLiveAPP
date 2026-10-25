import type { Metadata, Viewport } from 'next';
import './globals.css';

/** Метаданные приложения (реальные домены источников указаны в README) */
export const metadata: Metadata = {
  title: 'StreamLive — смотри всё',
  description:
    'Open Source архив живого ТВ и VOD: парсинг, вечный кэш, TikTok-style интерфейс. Без мок-данных — только реальный контент.',
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

/**
 * Корневой layout. Чистый Server Component:
 * pure black фон + full-height для scroll-snap ленты.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="bg-black">
      <body className="min-h-dvh bg-black text-white antialiased">{children}</body>
    </html>
  );
}
