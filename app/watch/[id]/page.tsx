import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import Spinner from '@/components/Spinner';
import BottomNav from '@/components/BottomNav';
import VideoCard from '@/components/VideoCard';
import { fetchContentById } from '@/lib/scraper';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const item = await fetchContentById(id);
  if (!item) return { title: 'Не найдено' };
  return {
    title: item.title,
    description: item.description || item.title,
    openGraph: {
      title: item.title,
      description: item.description || item.title,
      images: item.image ? [item.image] : [],
      type: 'video.other',
    },
    robots: { index: true, follow: true },
  };
}

async function WatchContent({ id }: { id: string }) {
  const item = await fetchContentById(id);
  if (!item) notFound();
  return (
    <div className="feed-snap">
      <VideoCard item={item} />
    </div>
  );
}

export default async function WatchPage({ params }: Props) {
  const { id } = await params;
  return (
    <main className="relative bg-black">
      <Suspense fallback={<Spinner label="Загружаем…" />}>
        <WatchContent id={id} />
      </Suspense>
      <div className="fixed left-4 top-4 z-50">
        <Link href="/" className="glass rounded-xl px-3 py-2 text-xs font-bold text-neon-cyan">
          ← Лента
        </Link>
      </div>
      <BottomNav />
    </main>
  );
}
