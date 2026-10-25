import Spinner from '@/components/Spinner';
import BottomNav from '@/components/BottomNav';
import ArchiveFeed from '@/components/ArchiveFeed';
import { readAllArchived } from '@/lib/archive';
import { FOREVER_REVALIDATE } from '@/lib/config';

/** Профиль = витрина ВЕЧНОГО АРХИВА: всё, что когда-либо было спаршено */
export const revalidate = FOREVER_REVALIDATE;

export default async function ProfilePage() {
  const archived = await readAllArchived();

  return (
    <main className="relative bg-black">
      {/* Шапка профиля поверх архивной ленты */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center gap-3 px-4 pt-4">
        <span className="glass flex h-12 w-12 items-center justify-center rounded-full text-lg font-black text-neon-cyan">
          SL
        </span>
        <div>
          <p className="video-text-shadow text-sm font-extrabold">@streamlive</p>
          <p className="text-[11px] text-white/60">{archived.length} карточек в вечном архиве ♾️</p>
        </div>
      </header>

      <SuspenseWrapper items={archived} />
      <BottomNav />
    </main>
  );
}

/** Suspense со спиннером вокруг клиентской ленты архива */
import { Suspense } from 'react';
function SuspenseWrapper({ items }: { items: Awaited<ReturnType<typeof readAllArchived>> }) {
  return (
    <Suspense fallback={<Spinner label="Открываем вечный архив…" />}>
      <ArchiveFeed items={items} />
    </Suspense>
  );
}
