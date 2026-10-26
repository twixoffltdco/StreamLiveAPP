import { Suspense } from 'react';
import Link from 'next/link';
import { MessagesSquare, AlertTriangle } from 'lucide-react';
import Spinner from '@/components/Spinner';
import BottomNav from '@/components/BottomNav';
import { fetchForumList } from '@/lib/forum';

export const dynamic = 'force-dynamic';

/** Список КАТЕГОРИЙ форума */
async function ForumList() {
  const data = await fetchForumList();

  if (data.allFailed || data.threads.length === 0) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertTriangle className="h-12 w-12 text-neon-pink opacity-70" />
        <h1 className="text-xl font-extrabold">Форум пока пуст</h1>
        <p className="max-w-sm text-sm text-white/60">
          Не удалось спарсить категории с зеркал. Попробуй позже.
        </p>
        {data.error && (
          <p className="glass max-w-full truncate rounded-xl px-4 py-2 font-mono text-[11px] text-neon-cyan">
            {data.error}
          </p>
        )}
        <Link
          href="/"
          className="mt-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-pink px-6 py-3 text-sm font-bold text-black active:scale-95"
        >
          К ленте
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-2 px-4 pb-28 pt-20">
      <div className="mb-4 flex items-center gap-2 px-1">
        <MessagesSquare className="h-5 w-5 text-neon-cyan" />
        <h1 className="text-lg font-extrabold">Форум</h1>
        <span className="glass ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-medium text-white/50">
          {data.origin.toUpperCase()} · {data.threads.length} категорий
        </span>
      </div>

      <ul className="space-y-2">
        {data.threads.map((cat) => (
          <li key={cat.id}>
            <Link
              href={`/forum/c/${cat.id}`}
              className="glass block rounded-2xl px-4 py-3 transition-colors hover:bg-white/10 active:scale-[0.99]"
            >
              <span className="line-clamp-2 text-sm font-semibold leading-snug text-white">
                {cat.title}
              </span>
              <span className="mt-1 block text-[11px] text-white/40">Категория · #{cat.id}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ForumPage() {
  return (
    <main className="relative min-h-dvh bg-black">
      <Suspense fallback={<Spinner label="Загружаем форум…" />}>
        <ForumList />
      </Suspense>
      <BottomNav />
    </main>
  );
}
