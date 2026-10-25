'use client';

/**
 * Глобальный error boundary в стиле приложения:
 * вместо жёлтого экрана Next.js — неоновый экран "Технические работы".
 */
import { RotateCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-6 bg-black px-6 text-center">
      <div className="tiktok-spinner opacity-40" />
      <h1 className="text-2xl font-extrabold">
        🛠️ Технические <span className="text-neon-pink">работы</span>
      </h1>
      <p className="max-w-sm text-sm text-white/70">
        Что-то пошло не так при загрузке эфира. Перезагрузи ленту — данные берутся прямо с серверов.
      </p>
      {error.digest && (
        <p className="font-mono text-[10px] text-white/40">digest: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-pink px-6 py-3 text-sm font-bold text-black transition-transform active:scale-95"
      >
        <RotateCcw className="h-4 w-4" /> Обновить
      </button>
    </main>
  );
}
