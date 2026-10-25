import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Film } from 'lucide-react';
import Spinner from '@/components/Spinner';
import VideoCard from '@/components/VideoCard';
import BottomNav from '@/components/BottomNav';
import { fetchVideosFeed } from '@/lib/fetcher';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Видео',
  description: 'Видеохостинг StreamLive: VOD и стримы с Prod и Reserve.',
  openGraph: {
    title: 'Видео — StreamLive',
    description: 'VOD и стримы StreamLive',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

async function VideosFeed() {
  const feed = await fetchVideosFeed();

  if (feed.allFailed || feed.items.length === 0) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-6 text-center">
        <Film className="h-12 w-12 text-neon-pink opacity-70" />
        <h1 className="text-xl font-extrabold">Пока пусто</h1>
        <p className="max-w-sm text-sm text-white/60">
          Раздел видео на зеркалах сейчас без карточек. Загляни на каналы или попробуй позже.
        </p>
        {feed.error && (
          <p className="glass max-w-full truncate rounded-xl px-4 py-2 font-mono text-[11px] text-neon-cyan">
            {feed.error}
          </p>
        )}
        <Link href="/" className="text-sm font-bold text-neon-cyan">
          ← К каналам
        </Link>
      </div>
    );
  }

  return (
    <div className="feed-snap">
      {feed.items.map((item) => (
        <VideoCard key={item.id} item={item} />
      ))}
    </div>
  );
}

export default function VideosPage() {
  return (
    <main className="relative bg-black">
      <Suspense fallback={<Spinner label="Загружаем видео…" />}>
        <VideosFeed />
      </Suspense>
      <BottomNav />
    </main>
  );
}
