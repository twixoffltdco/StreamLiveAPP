import { Suspense } from 'react';
import Link from 'next/link';
import { SearchX, Tv, Film, MessagesSquare } from 'lucide-react';
import Spinner from '@/components/Spinner';
import BottomNav from '@/components/BottomNav';
import { searchAll } from '@/lib/fetcher';

export const dynamic = 'force-dynamic';

async function SearchResults({ q }: { q: string }) {
  const { channels, videos, forum } = await searchAll(q, 40);
  const total = channels.length + videos.length + forum.length;

  if (total === 0) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 text-center">
        <SearchX className="h-12 w-12 text-neon-pink" />
        <p className="text-sm text-white/70">
          По запросу «<span className="font-bold text-white">{q}</span>» в локальной копии
          ничего нет.
        </p>
        <p className="max-w-sm text-xs text-white/40">
          Открой «Каналы», «Видео» или «Форум» — карточки попадут в архив, и поиск начнёт их
          находить. PHP при поиске не трогаем.
        </p>
        <Link href="/" className="text-sm font-bold text-neon-cyan">
          ← К ленте
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8 px-4 pb-28 pt-24">
      {channels.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-neon-cyan">
            <Tv className="h-4 w-4" /> Каналы · {channels.length}
          </h2>
          <ul className="flex flex-col gap-2">
            {channels.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/watch/${item.id}`}
                  className="glass block rounded-xl px-4 py-3 transition hover:bg-white/5"
                >
                  <div className="text-sm font-semibold">{item.title}</div>
                  <div className="mt-0.5 line-clamp-1 text-[11px] text-white/45">{item.description}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {videos.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-neon-cyan">
            <Film className="h-4 w-4" /> Видео · {videos.length}
          </h2>
          <ul className="flex flex-col gap-2">
            {videos.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/watch/${item.id}`}
                  className="glass block rounded-xl px-4 py-3 transition hover:bg-white/5"
                >
                  <div className="text-sm font-semibold">{item.title}</div>
                  <div className="mt-0.5 line-clamp-1 text-[11px] text-white/45">{item.description}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {forum.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-neon-cyan">
            <MessagesSquare className="h-4 w-4" /> Форум · {forum.length}
          </h2>
          <ul className="flex flex-col gap-2">
            {forum.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <Link
                  href={item.kind === 'category' ? `/forum/${item.id}` : `/forum/thread/${item.id}`}
                  className="glass block rounded-xl px-4 py-3 transition hover:bg-white/5"
                >
                  <div className="text-sm font-semibold">{item.title}</div>
                  <div className="mt-0.5 text-[11px] text-white/45">
                    {item.kind === 'category' ? 'Категория' : 'Тема'}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
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
    <main className="relative min-h-dvh bg-black">
      <form action="/search" method="get" className="fixed inset-x-0 top-4 z-50 mx-4 max-w-md">
        <div className="glass flex items-center gap-2 rounded-2xl px-4 py-3">
          <input
            name="q"
            defaultValue={q}
            placeholder="Каналы, видео, форум…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-white/40"
            autoComplete="off"
          />
          <button type="submit" className="text-xs font-bold text-neon-cyan">
            Искать
          </button>
        </div>
      </form>

      {q ? (
        <Suspense key={q} fallback={<Spinner label={`Ищем «${q}» в архиве…`} />}>
          <SearchResults q={q} />
        </Suspense>
      ) : (
        <div className="flex h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-sm text-white/50">Каналы · видео · темы форума</p>
          <p className="text-xs text-white/30">Поиск по локальной копии, без запросов на PHP</p>
        </div>
      )}

      <BottomNav />
    </main>
  );
}
