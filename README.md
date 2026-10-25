# 📺 StreamLive Web App

Современный open-source агрегатор стримингового контента на **Next.js 14 (App Router)**.  
Заменяет устаревший PHP-скрипт парсинга видео, добавляет серверное кэширование, умный Failover и SEO-дружественные роуты.

> Смотри всё. Даже если оригинальный источник умер — метаданные и архив остаются.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Deploy on Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com)
[![Deploy on Layer0 / Tatnet](https://img.shields.io/badge/Deploy-Layer0%20%2F%20Tatnet-orange)](https://layero.ru)

---

## ✨ Ключевые особенности

- **Вечное кэширование метаданных** — `unstable_cache` + файловый архив `data/archive.json`. Даже если оригинал удалён, карточки остаются.
- **Умный Failover** — сначала `streamlivetv.freedev.app`, при таймауте (>3 с) / 5xx / сети мгновенно переключается на `domtv.blyz.ru`.
- **Чистые SEO-ссылки** — `/watch/[id]` вместо `?id=`.
- **Обход блокировок iframe** — `referrerpolicy="no-referrer"` + серверный резолв JS-challenge (AES + PoW).
- **UI в стиле TikTok / Дзен** — вертикальный snap-скролл, glassmorphism, неоновые акценты.
- **Реальный поиск** — по живым источникам + фолбэк в локальный архив.
- **Серверный парсинг** — Cheerio на Node.js, никаких клиентских запросов к источникам.

---

## 🏗️ Архитектура и стек

| Слой | Технология |
|------|------------|
| Framework | Next.js 14 (App Router, Server Components) |
| Язык | TypeScript (strict) |
| Стили | Tailwind CSS 3.4 |
| Парсинг | Cheerio 1.x + node-html-parser |
| Кэш | `unstable_cache` (revalidate: false) + файловый архив |
| Failover | Prod → Reserve (config.ts) |
| Challenge | AES-cookie + Proof-of-Work (challenge.ts) |

Старый PHP-скрипт (`file_get_contents` + regex) полностью заменён на:

1. `lib/challenge.ts` — честный обход JS-защиты источников.
2. `lib/scraper.ts` / `lib/fetcher.ts` — failover + парсинг.
3. `lib/cache.ts` — вечный кэш + архив.
4. `lib/forum.ts` — парсер форумных тем.

Все данные приходят с реальных серверов. Моков нет.

---

## 🚀 Быстрый старт (Local Development)

```bash
# 1. Клонируй репозиторий
git clone https://github.com/YOUR_USERNAME/StreamLiveAPP.git
cd StreamLiveAPP

# 2. Установи зависимости
npm install

# 3. Скопируй переменные окружения
cp .env.example .env.local

# 4. Запусти dev-сервер
npm run dev
```

Открой [http://localhost:3000](http://localhost:3000).

```bash
# Сборка и продакшен-режим локально
npm run build
npm start
```

---

## ⚙️ Переменные окружения

Создай `.env.local` (или задай в панели хостинга):

```env
# Основной источник (Prod)
NEXT_PUBLIC_PROD_BASE=https://streamlivetv.freedev.app

# Резервный источник (Reserve)
NEXT_PUBLIC_RESERVE_BASE=https://domtv.blyz.ru

# Таймаут одного запроса (мс). После него — failover
FETCH_TIMEOUT_MS=3000

# Сколько карточек брать в ленту за один проход
FEED_LIMIT=12
```

Подробнее — в `.env.example`.

---

## 📦 Деплой

### Vercel (рекомендуется)

1. Импортируй репозиторий в [vercel.com](https://vercel.com).
2. Framework Preset: **Next.js**.
3. Добавь переменные из `.env.example`.
4. Deploy.

### Layer0 / Tatnet / Layero

1. Создай проект → **Node.js / Next.js** (не Static!).
2. Root Directory: корень репозитория.
3. Build Command: `npm run build` (или оставь по умолчанию).
4. Output / Start: Next.js standalone (проект уже настроен).
5. Обязательно задай переменные окружения `NEXT_PUBLIC_PROD_BASE` и `NEXT_PUBLIC_RESERVE_BASE`.

> ⚠️ Если сборка падает на TypeScript — убедись, что используется Node 18+ и свежий `npm install`.

### Другие хостинги (Railway, Render, Fly.io)

Любой хостинг с поддержкой Node.js 18+ и `next start` подойдёт.  
Не используй pure-static экспорт — проект зависит от Server Components и `unstable_cache`.

---

## 🤝 Contributing

Любые полезные PR приветствуются!

1. Форкни репозиторий.
2. Создай ветку: `git checkout -b feature/awesome-thing`.
3. Следуй стилю кода (TypeScript strict, Prettier не обязателен, но желателен).
4. Открой Pull Request с понятным описанием.

Подробные правила — в [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 🔒 Безопасность

Нашли уязвимость в парсинге, кэше или challenge-резолвере?  
Пишите приватно — см. [SECURITY.md](SECURITY.md).

---

## 📄 Лицензия

[MIT](LICENSE) © [year] [fullname]

---

**StreamLive Web App** — смотри стримы, даже когда источники падают.  
Сделано с ❤️ для open-source сообщества.
