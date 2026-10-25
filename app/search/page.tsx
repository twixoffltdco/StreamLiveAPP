import { Suspense } from 'react';
import Link from 'next/link';
import { SearchX } from 'lucide-react';
import Spinner from '@/components/Spinner';
import VideoCard from '@/components/VideoCard';
import BottomNav from '@/components/BottomNav';
import { searchFeed } from '@/lib/fetcher';

export const dynamic = 'force-dynamic';

/** Страница поиска: реальный fetch по источнику + fallback на вечный архив */
async function SearchResults({ q }: { q: string }) {
  const feed = await searchFeed(q);

  if (feed.items.length === 0) {
    return (
      <div className="flex h-[70dvh] flex-col items-center justify-center gap-4 text-center">
        <SearchX className="h-12 w-12 text-neon-pink" />
        <p className="text-sm text-white/70">
          По запросу «<span className="font-bold text-white">{q}</span>» ничего не нашлось ни на
          источниках, ни в вечном архиве.
        </p>
        <Link href="/" className="text-sm font-bold text-neon-cyan">
          ← К ленте
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

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;

  return (
    <main className="relative bg-black">
      {/* Стелянная строка поиска */}
      <form action="/search" method="get" className="fixed inset-x-0 top-4 z-50 mx-4 max-w-md">
        <div className="glass flex items-center gap-2 rounded-2xl px-4 py-3">
          <input
            name="q"
            defaultValue={q}
            placeholder="Найти канал или видео…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-white/40"
          />
          <button type="submit" className="text-xs font-bold text-neon-cyan">
            Искать
          </button>
        </div>
      </form>

      {q ? (
        <Suspense key={q} fallback={<Spinner label={`Ищем «${q}» в реальном эфире…`} />}>
          <SearchResults q={q} />
        </Suspense>
      ) : (
        <div className="flex h-dvh items-center justify-center">
          <p className="text-sm text-white/50">Введи запрос — ищем по живым источникам 🔎</p>
        </div>
      )}

      <BottomNav />
    </main>
  );
}
