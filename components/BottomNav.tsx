'use client';

import { Home, Search, Plus, User, MessagesSquare, Film } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/', label: 'Каналы', Icon: Home },
  { href: '/videos', label: 'Видео', Icon: Film },
  { href: '/search', label: 'Поиск', Icon: Search },
  { href: '/forum', label: 'Форум', Icon: MessagesSquare },
  { href: '/add', label: '', Icon: Plus, accent: true },
  { href: '/profile', label: 'Профиль', Icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex justify-center pb-[max(env(safe-area-inset-bottom),12px)]">
      <div className="glass mx-2 flex w-full max-w-lg items-center justify-around rounded-2xl px-1 py-2 shadow-neon-cyan">
        {items.map(({ href, label, Icon, accent }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));

          if (accent) {
            return (
              <Link
                key={href}
                href={href}
                aria-label="Добавить"
                className="flex h-10 w-11 items-center justify-center rounded-xl bg-gradient-to-r from-neon-cyan to-neon-pink text-black transition-transform active:scale-90"
              >
                <Icon className="h-5 w-5 stroke-[3]" />
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-1.5 py-1 transition-colors ${
                active ? 'text-neon-cyan' : 'text-white/60 hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              <span className="text-[9px] font-semibold">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
