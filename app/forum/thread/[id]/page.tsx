import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import Spinner from '@/components/Spinner';
import BottomNav from '@/components/BottomNav';
import { fetchForumThread } from '@/lib/forum';

export const dynamic = 'force-dynamic';

async function ThreadBody({ id }: { id: string }) {
  // fetchForumThread сначала пробует category, потом thread —
  // для /forum/thread/id нам нужна именно тема: id уже thread id
  const thread = await fetchForumThread(id);
  if (!thread) notFound();

  return (
    <article className="mx-auto max-w-lg px-4 pb-28 pt-16">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/forum"
          className="glass flex h-9 w-9 items-center justify-center rounded-xl text-neon-cyan"
          aria-label="Назад"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="glass rounded-full px-2.5 py-0.5 text-[10px] font-medium text-white/50">
          {thread.origin.toUpperCase()} · #{thread.id}
        </span>
      </div>

      <h1 className="mb-2 text-xl font-extrabold leading-tight">{thread.title}</h1>
      {thread.description && (
        <p className="mb-4 text-sm text-white/60">{thread.description}</p>
      )}

      {thread.postsHtml ? (
        <div
          className="prose prose-invert prose-sm max-w-none space-y-3 rounded-2xl bg-white/5 p-4 text-white/85 [&_a]:text-neon-cyan [&_img]:max-h-64 [&_img]:rounded-xl"
          dangerouslySetInnerHTML={{ __html: thread.postsHtml }}
        />
      ) : (
        <pre className="whitespace-pre-wrap rounded-2xl bg-white/5 p-4 text-sm leading-relaxed text-white/80">
          {thread.plainText}
        </pre>
      )}

      <a
        href={thread.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-sm font-bold text-neon-cyan active:scale-95"
      >
        <ExternalLink className="h-4 w-4" />
        Открыть на источнике
      </a>
    </article>
  );
}

export default async function ForumThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="relative min-h-dvh bg-black">
      <Suspense fallback={<Spinner label="Загружаем тему…" />}>
        <ThreadBody id={id} />
      </Suspense>
      <BottomNav />
    </main>
  );
}
