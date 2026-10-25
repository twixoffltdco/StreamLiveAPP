import Link from 'next/link';

/** 404 в стиле приложения — без дефолтного экрана Next.js */
export default function NotFound() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-black text-center">
      <h1 className="text-6xl font-black">
        <span className="text-neon-cyan">4</span>
        <span className="text-neon-pink">0</span>
        <span className="text-neon-cyan">4</span>
      </h1>
      <p className="text-sm text-white/70">Такого эфира нет в вечном архиве 🙃</p>
      <Link
        href="/"
        className="rounded-xl bg-gradient-to-r from-neon-cyan to-neon-pink px-5 py-2.5 text-sm font-bold text-black"
      >
        В ленту
      </Link>
    </main>
  );
}
