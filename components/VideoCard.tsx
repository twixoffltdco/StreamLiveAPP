'use client';

/**
 * VideoCard — карточка контента в стиле TikTok (Zoomer 2026).
 *
 * Структура:
 *  - фон: превью og:image (реальное, с источника);
 *  - по тапу на превью подгружается РЕАЛЬНЫЙ iframe-плеер (embed.php / embed_video.php)
 *    — экономим трафик и не грузим dozen плееров одновременно;
 *  - снизу градиентная подложка с title/description (text-shadow);
 *  - справа стеклянная панель: Like, Comment, Share, PiP.
 */

import { Heart, MessageCircle, Share2, Play } from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';
import type { StreamContent } from '@/lib/types';

/** Иконка Picture-in-Picture (в lucide нет готовой — рисуем SVG в стиле набора) */
function PipGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <rect x="12" y="11" width="8" height="6" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function VideoCard({ item }: { item: StreamContent }) {
  // Плеер грузим только по тапу — иначе лента из N iframe убьёт мобильный трафик
  const [playerOn, setPlayerOn] = useState(false);
  const [liked, setLiked] = useState(false);
  const [shareMsg, setShareMsg] = useState(false);

  /** Поделиться: реальный Web Share API, fallback — копирование ссылки */
  async function handleShare() {
    const shareData = { title: item.title, text: item.description, url: item.sourceUrl };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(item.sourceUrl);
      }
      setShareMsg(true);
      setTimeout(() => setShareMsg(false), 1500);
    } catch {
      /* пользователь закрыл sheet */
    }
  }

  /**
   * PiP для iframe невозможен напрямую (iframe cross-origin),
   * поэтому открываем embed-страницу в отдельном компактном окне —
   * пользователь сможет включить системный режим "картинка в картинке".
   */
  function handlePip() {
    window.open(item.embedUrl, 'streamlive-pip', 'popup,width=480,height=320');
  }

  return (
    <section className="relative h-dvh w-full shrink-0 overflow-hidden bg-black animate-rise">
      {/* ===== Фон: реальное превью og:image или активный плеер ===== */}
      {playerOn ? (
        <iframe
          src={item.embedUrl}
          title={item.title}
          className="absolute inset-0 h-full w-full border-0 bg-black"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : item.image ? (
        <Image
          src={item.image}
          alt={item.title}
          fill
          sizes="100vw"
          priority={false}
          className="object-cover opacity-90"
          unoptimized /* og:image отдаётся с домена источника без next.config оптимизации */
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-black to-neutral-900" />
      )}

      {/* Тап по превью включает реальный плеер */}
      {!playerOn && (
        <button
          onClick={() => setPlayerOn(true)}
          aria-label="Включить эфир"
          className="absolute inset-0 z-10 flex items-center justify-center"
        >
          <span className="glass flex h-20 w-20 items-center justify-center rounded-full shadow-neon-cyan transition-transform active:scale-90">
            <Play className="h-9 w-9 translate-x-0.5 fill-neon-cyan text-neon-cyan" />
          </span>
        </button>
      )}

      {/* ===== Верхняя плашка LIVE + origin ===== */}
      <div className="pointer-events-none absolute left-4 top-4 z-20 flex items-center gap-2">
        <span className="glass flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
          <span className="live-dot h-2 w-2 rounded-full bg-neon-pink" />
          {item.kind === 'video' ? 'VOD' : 'Live'}
        </span>
        <span className="glass rounded-full px-3 py-1 text-[10px] font-medium text-white/60">
          {item.origin === 'prod' ? 'PROD' : 'RESERVE'} · archived forever
        </span>
      </div>

      {/* ===== Правая стеклянная панель действий ===== */}
      <aside className="absolute bottom-32 right-3 z-20 flex flex-col items-center gap-5">
        <button
          onClick={() => setLiked((v) => !v)}
          aria-label="Нравится"
          className="flex flex-col items-center gap-1 transition-transform active:scale-90"
        >
          <span className="glass flex h-12 w-12 items-center justify-center rounded-full">
            <Heart className={`h-6 w-6 ${liked ? 'fill-neon-pink text-neon-pink' : 'text-white'}`} />
          </span>
          <span className="video-text-shadow text-[11px] font-semibold">{liked ? 'Вы' : 'Like'}</span>
        </button>

        <button
          onClick={() => setPlayerOn(true)}
          aria-label="Комментарии"
          className="flex flex-col items-center gap-1 transition-transform active:scale-90"
        >
          <span className="glass flex h-12 w-12 items-center justify-center rounded-full">
            <MessageCircle className="h-6 w-6 text-white" />
          </span>
          <span className="video-text-shadow text-[11px] font-semibold">Chat</span>
        </button>

        <button
          onClick={handleShare}
          aria-label="Поделиться"
          className="flex flex-col items-center gap-1 transition-transform active:scale-90"
        >
          <span className="glass relative flex h-12 w-12 items-center justify-center rounded-full">
            <Share2 className="h-6 w-6 text-white" />
            {shareMsg && (
              <span className="absolute -top-8 whitespace-nowrap rounded-md bg-neon-cyan px-2 py-0.5 text-[10px] font-bold text-black">
                Ссылка там! 🔥
              </span>
            )}
          </span>
          <span className="video-text-shadow text-[11px] font-semibold">Share</span>
        </button>

        <button
          onClick={handlePip}
          aria-label="Picture-in-Picture"
          className="flex flex-col items-center gap-1 transition-transform active:scale-90"
        >
          <span className="glass flex h-12 w-12 items-center justify-center rounded-full shadow-neon-pink">
            <PipGlyph className="h-6 w-6 text-neon-cyan" />
          </span>
          <span className="video-text-shadow text-[11px] font-semibold">PiP</span>
        </button>
      </aside>

      {/* ===== Нижняя градиентная подложка с meta (Cheerio-парсинг) ===== */}
      <footer className="card-gradient pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 px-4 pb-24 pt-24">
        <h2 className="video-text-shadow max-w-[78%] text-lg font-extrabold leading-tight">{item.title}</h2>
        <p className="video-text-shadow max-w-[78%] text-sm leading-snug text-white/85 line-clamp-2">
          {item.description}
        </p>
      </footer>
    </section>
  );
}
