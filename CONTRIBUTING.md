# 🤝 Contributing to StreamLive Web App

Спасибо, что хочешь помочь проекту! Любые полезные изменения приветствуются.

## Как внести вклад

1. **Форкни** репозиторий на GitHub / Gitverse.
2. **Клонируй** свой форк:
   ```bash
   git clone https://github.com/YOUR_USERNAME/StreamLiveAPP.git
   cd StreamLiveAPP
   ```
3. Создай ветку от `main`:
   ```bash
   git checkout -b feature/short-description
   # или
   git checkout -b fix/issue-123
   ```
4. Внеси изменения. Следуй правилам ниже.
5. Убедись, что проект собирается:
   ```bash
   npm install
   npm run build
   npm run lint
   ```
6. Закоммить с понятным сообщением (Conventional Commits приветствуются):
   ```bash
   git commit -m "fix: resolve Cheerio AnyNode type error in forum.ts"
   ```
7. Запушь и открой **Pull Request** в upstream `main`.

## Стиль кода

- **TypeScript strict** — не отключай `strict` и не используй `@ts-ignore` без крайней необходимости.
- **Server Components** по умолчанию. `'use client'` только там, где реально нужен браузерный API (VideoCard, интерактив).
- **Никаких моков** в продакшен-коде. Все данные — только с реальных источников + архив.
- Имена файлов и экспортов — в стиле существующего кода (`lib/fetcher.ts`, `fetchFeed`, `StreamContent`).
- Комментарии — на русском или английском, коротко и по делу (особенно в `lib/*`).

## Что особенно нужно

- Улучшение парсеров (новые селекторы, устойчивость к изменениям вёрстки источников).
- Расширение архива / поиск по архиву.
- UI/UX полировка (мобильный опыт, accessibility).
- Документация и примеры деплоя.
- Тесты (пока их мало — можно добавить).

## Чего лучше не делать

- Не добавляй тяжёлые клиентские библиотеки без необходимости.
- Не ломай failover и challenge-резолвер без тестов на реальных источниках.
- Не коммить `.env`, `data/archive.json`, `node_modules`.

## Вопросы

Открывай Issue с меткой `question` или пиши в PR. Мы отвечаем по возможности быстро.
