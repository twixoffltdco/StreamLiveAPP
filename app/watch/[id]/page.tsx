import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Spinner from '@/components/Spinner';
import BottomNav from '@/components/BottomNav';
import VideoCard from '@/components/VideoCard';
import { fetchContentById } from '@/lib/scraper';

export const dynamic = 'force-dynamic';

async function WatchContent({ id }: { id: string }) {
  const item = await fetchContentById(id);
  if (!item) notFound();

  return (
    <div className="feed-snap">
      <VideoCard item={item} />
    </div>
  );
}

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="relative bg-black">
      <Suspense fallback={<Spinner label="Загружаем видео…" />}>
        <WatchContent id={id} />
      </Suspense>
      <div className="fixed left-4 top-4 z-50">
        <Link
          href="/"
          className="glass rounded-xl px-3 py-2 text-xs font-bold text-neon-cyan"
        >
          ← Лента
        </Link>
      </div>
      <BottomNav />
    </main>
  );
}
