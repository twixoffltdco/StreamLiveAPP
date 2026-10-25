'use client';

/**
 * StreamPlayer — та же логика, что в PHP embed.php:
 *   1) iframe (VK / YouTube / Twitch / OK / Rutube / type=iframe)
 *   2) HLS (.m3u8)
 *   3) Playerjs — всё остальное (mp4, stream URL)
 *
 * Если передан только embedUrl (страница источника) — грузим её в iframe
 * с cinema=0 / referrerPolicy=no-referrer.
 */

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    Playerjs?: new (opts: { id: string; file: string; autoplay?: number }) => unknown;
    Hls?: {
      isSupported: () => boolean;
      new (): { loadSource: (u: string) => void; attachMedia: (v: HTMLVideoElement) => void };
    };
  }
}

function isIframeSource(u: string, t?: string): boolean {
  const type = (t || '').toLowerCase();
  if (['iframe', 'embed', 'vk', 'youtube', 'twitch', 'ok', 'rutube'].includes(type)) return true;
  return /youtube\.com\/embed|youtu\.be\/|player\.twitch\.tv|twitch\.tv\/|vk\.com\/video_ext|vk\.com\/video|ok\.ru\/videoembed|rutube\.ru\/play\/embed|vimeo\.com\/video|dailymotion\.com\/embed/i.test(
    u,
  );
}

function isHls(u: string, t?: string): boolean {
  const type = (t || '').toLowerCase();
  return type === 'hls' || type === 'm3u8' || /\.m3u8($|\?)/i.test(u);
}

/** Нормализация VK / YouTube / Twitch → embed URL */
export function normalizeStreamUrl(raw: string): { url: string; type?: string } {
  let url = raw.trim();
  let type: string | undefined;

  const vk = url.match(/vk\.com\/(?:video_ext\.php\?|video)(-?\d+)_(\d+)/i);
  if (vk) {
    url = `https://vk.com/video_ext.php?oid=${encodeURIComponent(vk[1])}&id=${encodeURIComponent(vk[2])}&hd=2&autoplay=1`;
    type = 'iframe';
  }

  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/i);
  if (yt) {
    url = `https://www.youtube.com/embed/${yt[1]}?autoplay=1`;
    type = 'iframe';
  }

  const tw = url.match(/twitch\.tv\/([A-Za-z0-9_]+)$/i);
  if (tw && typeof window !== 'undefined') {
    const parent = window.location.hostname || 'localhost';
    url = `https://player.twitch.tv/?channel=${encodeURIComponent(tw[1])}&parent=${encodeURIComponent(parent)}&autoplay=true`;
    type = 'iframe';
  }

  return { url, type };
}

function ensureCinemaZero(embedUrl: string): string {
  try {
    const u = new URL(embedUrl);
    if (/embed\.php/i.test(u.pathname)) {
      u.searchParams.set('cinema', '0');
    }
    return u.toString();
  } catch {
    return embedUrl;
  }
}

type Props = {
  /** Прямой URL потока или страницы-плеера */
  src?: string | null;
  /** Тип: iframe | hls | mp4 | … */
  sourceType?: string | null;
  /** Страница embed источника (если нет прямого src) */
  embedUrl?: string | null;
  /** Откуда грузить playerjs.js (по умолчанию с PROD) */
  playerjsBase?: string;
  className?: string;
  title?: string;
};

export default function StreamPlayer({
  src,
  sourceType,
  embedUrl,
  playerjsBase = 'https://streamlivetv.freedev.app',
  className = '',
  title = 'Stream',
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [fallbackEmbed, setFallbackEmbed] = useState<string | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    el.innerHTML = '';
    setFallbackEmbed(null);

    // Нет прямого src — только страница embed источника
    if (!src && embedUrl) {
      setFallbackEmbed(ensureCinemaZero(embedUrl));
      return;
    }
    if (!src) {
      el.innerHTML =
        '<div style="color:#666;display:flex;align-items:center;justify-content:center;height:100%;font-family:sans-serif">Нет источника</div>';
      return;
    }

    const norm = normalizeStreamUrl(src);
    const url = norm.url;
    const type = sourceType || norm.type || '';

    // 1) iframe
    if (isIframeSource(url, type)) {
      const f = document.createElement('iframe');
      f.src = url;
      f.title = title;
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.setAttribute('allowfullscreen', 'true');
      f.setAttribute('referrerpolicy', 'no-referrer');
      f.style.cssText = 'width:100%;height:100%;border:0;position:absolute;inset:0';
      el.appendChild(f);
      return;
    }

    // 2) HLS
    if (isHls(url, type)) {
      const v = document.createElement('video');
      v.controls = true;
      v.autoplay = true;
      v.playsInline = true;
      v.muted = true;
      v.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000;position:absolute;inset:0';
      el.appendChild(v);

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js';
      script.onload = () => {
        if (window.Hls?.isSupported()) {
          const h = new window.Hls!();
          h.loadSource(url);
          h.attachMedia(v);
          v.play().catch(() => {});
        } else {
          v.src = url;
          v.play().catch(() => {});
        }
      };
      script.onerror = () => {
        v.src = url;
      };
      document.head.appendChild(script);
      return () => {
        script.remove();
      };
    }

    // 3) Playerjs — всё остальное (mp4, stream, кастом)
    const pj = document.createElement('script');
    pj.src = `${playerjsBase.replace(/\/$/, '')}/playerjs.js`;
    pj.onload = () => {
      if (typeof window.Playerjs !== 'undefined') {
        try {
          el.id = el.id || 'playerjs-container';
          // Playerjs ищет элемент по id
          const id = el.id;
          // eslint-disable-next-line no-new
          new window.Playerjs!({ id, file: url, autoplay: 1 });
          return;
        } catch {
          /* fallback below */
        }
      }
      const v = document.createElement('video');
      v.src = url;
      v.controls = true;
      v.autoplay = true;
      v.playsInline = true;
      v.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000;position:absolute;inset:0';
      el.appendChild(v);
    };
    pj.onerror = () => {
      // Playerjs недоступен — пробуем embed-страницу источника
      if (embedUrl) {
        setFallbackEmbed(ensureCinemaZero(embedUrl));
        return;
      }
      const v = document.createElement('video');
      v.src = url;
      v.controls = true;
      v.autoplay = true;
      v.playsInline = true;
      v.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000;position:absolute;inset:0';
      el.appendChild(v);
    };
    document.head.appendChild(pj);

    return () => {
      pj.remove();
    };
  }, [src, sourceType, embedUrl, playerjsBase, title]);

  if (fallbackEmbed) {
    return (
      <iframe
        src={fallbackEmbed}
        title={title}
        className={`absolute inset-0 h-full w-full border-0 bg-black ${className}`}
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      ref={rootRef}
      className={`absolute inset-0 h-full w-full bg-black ${className}`}
      id="streamlive-player-root"
    />
  );
}
