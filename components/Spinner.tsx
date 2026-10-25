/**
 * TikTok-подобный неоновый спиннер.
 * Показывается, пока идёт реальный fetch с серверов-источников.
 * Не «чёрный экран»: есть спиннер + подпись + лёгкий градиент.
 */
export default function Spinner({ label = 'Загружаем реальный эфир…' }: { label?: string }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-6 bg-gradient-to-b from-black via-[#0a0a0f] to-black px-6 text-center">
      <div className="tiktok-spinner" />
      <p className="animate-pulse text-sm font-semibold uppercase tracking-widest text-white/80">
        {label}
      </p>
      <p className="max-w-xs text-xs text-white/40">
        Парсим живые источники и архив… это займёт пару секунд
      </p>
    </div>
  );
}
