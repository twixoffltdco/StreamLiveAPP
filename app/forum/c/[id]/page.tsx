import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import Spinner from '@/components/Spinner';
import BottomNav from '@/components/BottomNav';
import { fetchCategoryThreads, fetchForumList } from '@/lib/forum';

export const dynamic = 'force-dynamic';

async function CategoryBody({ id }: { id: string }) {
  const [list, cats] = await Promise.all([
    fetchCategoryThreads(id),
    fetchForumList().catch(() => null),
  ]);
  const catTitle =
    cats?.threads.find((t) => t.id === id)?.title || `Категория #${id}`;

  if (list.allFailed && list.threads.length === 0) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertTriangle className="h-10 w-10 text-neon-pink opacity-70" />
        <p className="text-sm text-white/60">В категории нет тем или источник не ответил.</p>
        <Link href="/forum" className="text-sm font-bold text-neon-cyan">
          ← К категориям
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-2 px-4 pb-28 pt-16">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/forum"
          className="glass flex h-9 w-9 items-center justify-center rounded-xl text-neon-cyan"
          aria-label="Назад"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-lg font-extrabold leading-tight">{catTitle}</h1>
          <p className="text-[11px] text-white/40">
            {list.threads.length} тем · {list.origin.toUpperCase()}
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {list.threads.map((th) => (
          <li key={th.id}>
            <Link
              href={`/forum/thread/${th.id}`}
              className="glass block rounded-2xl px-4 py-3 transition-colors hover:bg-white/10"
            >
              <span className="line-clamp-2 text-sm font-semibold text-white">{th.title}</span>
              <span className="mt-1 block text-[11px] text-white/40">Тема · #{th.id}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function ForumCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="relative min-h-dvh bg-black">
      <Suspense fallback={<Spinner label="Загружаем категорию…" />}>
        <CategoryBody id={id} />
      </Suspense>
      <BottomNav />
    </main>
  );
}
