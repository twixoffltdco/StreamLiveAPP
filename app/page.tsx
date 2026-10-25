import { Suspense } from 'react';
import Spinner from '@/components/Spinner';
import VideoCard from '@/components/VideoCard';
import BottomNav from '@/components/BottomNav';
import { fetchFeed } from '@/lib/fetcher';

/**
 * Страница живёт динамически: первый запрос парсит источник,
 * дальше данные отдаются из вечного кэша (unstable_cache, revalidate = 1 год).
 */
export const dynamic = 'force-dynamic';

/** Лента — отдельный Server Component под Suspense со спиннером */
async function Feed() {
  const feed = await fetchFeed();

  // ===== Экран "Технические работы" (graceful degradation) =====
  if (feed.allFailed || feed.items.length === 0) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-6 bg-black px-6 text-center">
        <div className="tiktok-spinner opacity-40" />
        <h1 className="text-2xl font-extrabold tracking-tight">
          🛠️ Технические <span className="text-neon-pink">работы</span>
        </h1>
        <p className="max-w-sm text-sm leading-relaxed text-white/70">
          Оба эфира (Prod и Reserve) сейчас недоступны, а вечный архив ещё пуст. Мы уже чиним —
          обнови страницу через пару минут.
        </p>
        <p className="glass max-w-full truncate rounded-xl px-4 py-2 font-mono text-[11px] text-neon-cyan">
          {feed.error ?? 'source unavailable'}
        </p>
        <a
          href="/"
          className="rounded-xl bg-gradient-to-r from-neon-cyan to-neon-pink px-6 py-3 text-sm font-bold text-black transition-transform active:scale-95"
        >
          Попробовать снова
        </a>
        <BottomNav />
      </main>
    );
  }

  // ===== Реальная лента из спаршенного контента (scroll-snap) =====
  return (
    <div className="feed-snap">
      {feed.items.map((item) => (
        <VideoCard key={item.id} item={item} />
      ))}
    </div>
  );
}

/**
 * Главная страница — Server Component: показывает TikTok-спиннер,
 * пока идёт реальный fetch с серверов-источников.
 */
export default function HomePage() {
  return (
    <main className="relative bg-black">
      <Suspense fallback={<Spinner />}>
        <Feed />
      </Suspense>
      <BottomNav />
    </main>
  );
}
