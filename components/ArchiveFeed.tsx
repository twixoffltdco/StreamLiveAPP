'use client';

/**
 * Лента из вечного архива для страницы профиля:
 * показывает РЕАЛЬНО закешированные когда-либо карточки (без моков).
 */

import VideoCard from './VideoCard';
import type { StreamContent } from '@/lib/types';

export default function ArchiveFeed({ items }: { items: StreamContent[] }) {
  if (items.length === 0) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-black px-6 text-center">
        <p className="text-4xl">🗃️</p>
        <p className="text-sm text-white/60">
          Вечный архив пока пуст. Зайди на главную — первое же скроллинг-сессия наполнит его
          реальными данными с Prod/Reserve.
        </p>
      </div>
    );
  }

  return (
    <div className="feed-snap">
      {items.map((item) => (
        <VideoCard key={item.id} item={item} />
      ))}
    </div>
  );
}
