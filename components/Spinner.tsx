/**
 * TikTok-подобный неоновый спиннер.
 * Показывается, пока идёт реальный fetch с серверов-источников.
 */
export default function Spinner({ label = 'Загружаем реальный эфир…' }: { label?: string }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-6 bg-black">
      <div className="tiktok-spinner" />
      <p className="animate-pulse-neon text-sm font-semibold uppercase tracking-widest text-white/70">
        {label}
      </p>
    </div>
  );
}
