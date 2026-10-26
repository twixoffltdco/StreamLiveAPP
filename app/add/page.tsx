'use client';

/**
 * Добавить эфир вручную → парсинг → ОБЩИЙ архив (видят все).
 */

import { useState } from 'react';
import { Code2, Copy, Check, Loader2, Save } from 'lucide-react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import type { StreamContent } from '@/lib/types';

interface ApiResponse {
  ok: boolean;
  data?: StreamContent;
  iframe?: string;
  saved?: boolean;
  error?: string;
}

export default function AddPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [copied, setCopied] = useState(false);

  async function parse() {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/fetch-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
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
      <p className="mb-6 max-w-md text-center text-xs text-white/50">
        Ссылка на channel.php / video.php с любого зеркала. Карточка пишется в общий архив и
        появляется у всех в ленте и поиске.
      </p>

      <div className="glass flex w-full max-w-md items-center gap-2 rounded-2xl p-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…/channel.php?slug=…"
          className="w-full bg-transparent px-3 text-sm outline-none placeholder:text-white/30"
        />
        <button
          onClick={parse}
          disabled={loading}
          className="flex shrink-0 items-center gap-1 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-pink px-4 py-2 text-xs font-bold text-black disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {loading ? '…' : 'В архив'}
        </button>
      </div>

      {result && !result.ok && (
        <p className="mt-6 max-w-md text-center text-sm text-neon-pink">{result.error}</p>
      )}

      {result?.ok && result.data && (
        <div className="glass mt-8 w-full max-w-md space-y-4 rounded-2xl p-5">
          {result.saved && (
            <p className="rounded-xl bg-neon-cyan/15 px-3 py-2 text-center text-xs font-bold text-neon-cyan">
              Сохранено в общий архив · origin: {result.data.origin}
            </p>
          )}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/40">Название</p>
            <p className="font-bold">{result.data.title}</p>
          </div>
          {result.data.description && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40">Описание</p>
              <p className="text-sm text-white/70">{result.data.description}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/watch/${result.data.id}`}
              className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-neon-cyan"
            >
              Открыть карточку
            </Link>
            <button
              onClick={copyIframe}
              className="flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-neon-cyan" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Скопировано' : 'iframe'}
            </button>
          </div>
          {result.iframe && (
            <pre className="overflow-x-auto rounded-xl bg-black/50 p-3 text-[10px] text-white/50">
              <Code2 className="mb-1 inline h-3 w-3" /> {result.iframe}
            </pre>
          )}
        </div>
      )}

      <BottomNav />
    </main>
  );
}
