'use client';

/**
 * Страница "Добавить": принимает URL страницы источника (channel.php / video.php),
 * дергает РЕАЛЬНЫЙ API /api/fetch-content для парсинга метаданных и показывает
 * готовый чистый iframe-код (embed.php / embed_video.php маппинг).
 */

import { useState } from 'react';
import { Code2, Copy, Check, Loader2 } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import type { StreamContent } from '@/lib/types';

interface ApiResponse {
  ok: boolean;
  data?: StreamContent;
  iframe?: string;
  error?: string;
}

export default function AddPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [copied, setCopied] = useState(false);

  /** Реальный вызов серверного парсера через API route */
  async function parse() {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/fetch-content?url=${encodeURIComponent(url.trim())}`);
      const json = (await res.json()) as ApiResponse;
      setResult(json);
    } catch (e) {
      setResult({ ok: false, error: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function copyIframe() {
    if (!result?.iframe) return;
    await navigator.clipboard.writeText(result.iframe);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center bg-black px-4 pt-16 pb-32">
      <h1 className="mb-2 text-xl font-extrabold">
        Добавить <span className="text-neon-cyan">эфир</span>
      </h1>
      <p className="mb-6 text-center text-xs text-white/50">
        Вставь ссылку на channel.php или video.php — проспарсим meta и смапим в embed навсегда.
      </p>

      <div className="glass flex w-full max-w-md items-center gap-2 rounded-2xl p-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://streamlivetv.freedev.app/channel.php?id=..."
          className="w-full bg-transparent px-3 text-sm outline-none placeholder:text-white/30"
        />
        <button
          onClick={parse}
          disabled={loading}
          className="flex shrink-0 items-center gap-1 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-pink px-4 py-2 text-xs font-bold text-black disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Code2 className="h-4 w-4" />}
          Парсить
        </button>
      </div>

      {result?.ok && result.data && (
        <div className="animate-rise glass mt-6 w-full max-w-md space-y-3 rounded-2xl p-4">
          <h2 className="text-sm font-bold">{result.data.title}</h2>
          <p className="line-clamp-2 text-xs text-white/70">{result.data.description}</p>
          <p className="font-mono text-[10px] text-neon-cyan">{result.data.embedUrl}</p>
          <button
            onClick={copyIframe}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold transition-colors hover:bg-white/20"
          >
            {copied ? <Check className="h-4 w-4 text-neon-cyan" /> : <Copy className="h-4 w-4" />}
            {result.iframe}
          </button>
        </div>
      )}

      {result && !result.ok && (
        <p className="glass mt-6 max-w-md rounded-xl px-4 py-3 text-center text-xs text-neon-pink">
          Не удалось распарсить: {result.error ?? 'источник недоступен'}
        </p>
      )}

      <BottomNav />
    </main>
  );
}
