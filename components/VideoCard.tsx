'use client';

/**
 * VideoCard — карточка контента в стиле TikTok (Zoomer 2026).
 *
 * - по тапу подгружается iframe-плеер (embed.php)
 * - referrerPolicy="no-referrer" — обход части блокировок iframe
 * - fallback «Открыть на источнике», если iframe чёрный (JS-challenge)
 */

import { Heart, MessageCircle, Share2, Play, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';
import type { StreamContent } from '@/lib/types';

function PipGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <rect x="12" y="11" width="8" height="6" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function VideoCard({ item }: { item: StreamContent }) {
  const [playerOn, setPlayerOn] = useState(false);
  const [liked, setLiked] = useState(false);
  const [shareMsg, setShareMsg] = useState(false);

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
      /* user closed sheet */
    }
  }

  function handlePip() {
    window.open(item.embedUrl, 'streamlive-pip', 'popup,width=480,height=320');
  }

  function openOnSource() {
    window.open(item.embedUrl || item.sourceUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="relative h-dvh w-full shrink-0 overflow-hidden bg-black animate-rise">
      {playerOn ? (
        <iframe
          src={item.embedUrl}
          title={item.title}
          className="absolute inset-0 h-full w-full border-0 bg-black"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer"
          
        />
      ) : item.image ? (
        <Image
          src={item.image}
          alt={item.title}
          fill
          sizes="100vw"
          priority={false}
          className="object-cover opacity-90"
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-black to-neutral-900" />
      )}

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

      {playerOn && (
        <div className="absolute left-1/2 top-1/2 z-30 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 pointer-events-none">
          <button
            onClick={openOnSource}
            className="pointer-events-auto glass flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-neon-cyan shadow-neon-cyan transition-transform active:scale-95"
          >
            <ExternalLink className="h-4 w-4" />
            Открыть эфир на источнике
          </button>
          <p className="pointer-events-none max-w-[240px] text-center text-[11px] text-white/50">
            Если экран чёрный — источник блокирует iframe. Жми кнопку выше.
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute left-4 top-4 z-20 flex items-center gap-2">
        <span className="glass flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
          <span className="h-2 w-2 animate-pulse rounded-full bg-neon-pink" />
          Live
        </span>
        <span className="glass rounded-full px-3 py-1 text-[10px] font-medium text-white/60">
          {item.origin.toUpperCase()} · archived forever
        </span>
      </div>

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

        <button
          onClick={openOnSource}
          aria-label="Открыть на источнике"
          className="flex flex-col items-center gap-1 transition-transform active:scale-90"
        >
          <span className="glass flex h-12 w-12 items-center justify-center rounded-full">
            <ExternalLink className="h-5 w-5 text-neon-cyan" />
          </span>
          <span className="video-text-shadow text-[11px] font-semibold">Source</span>
        </button>
      </aside>

      <footer className="card-gradient pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 px-4 pb-24 pt-24">
        <h2 className="video-text-shadow max-w-[78%] text-lg font-extrabold leading-tight">{item.title}</h2>
        <p className="video-text-shadow max-w-[78%] text-sm leading-snug text-white/85 line-clamp-2">
          {item.description}
        </p>
      </footer>
    </section>
  );
}
