/**
 * lib/challenge.ts — обход JS-защиты источников StreamLive.
 *
 * Оба сервера (Prod и Reserve) отдают вместо контента мини-челленджи:
 *  1) slowAES cookie-challenge: страница с <script src="/aes.js">, которая
 *     расшифровывает cookie `__test` и редиректит на ?i=N;
 *  2) proof-of-work "Проверка браузера": нужно подобрать nonce, чтобы
 *     SHA-256(seed + nonce) начинался с "0000", и записать cookie `ddos_pow`.
 *
 * Модуль эмулирует поведение браузера на сервере (Node.js), скачивая aes.js
 * исполняя его в изолированном vm-контексте. Никаких мок-данных — только
 * реальный криптографический ответ на реальный challenge.
 */

import { createHash } from 'crypto';
import * as vm from 'vm';
import { BROWSER_UA, FETCH_TIMEOUT_MS } from './config';

/** Кэш решённых challenge по origin (cookie не меняются часто) */
const solved = new Map<string, string>();

/** Agent без проверки TLS — для зеркал со слетевшим сертификатом (domtv и т.п.) */
let insecureDispatcher: unknown = null;
async function getInsecureDispatcher() {
  if (insecureDispatcher) return insecureDispatcher;
  try {
    const { Agent } = await import('undici');
    insecureDispatcher = new Agent({ connect: { rejectUnauthorized: false } });
  } catch {
    insecureDispatcher = null;
  }
  return insecureDispatcher;
}

/** Таймаут fetch; при ошибке сертификата — повтор с rejectUnauthorized: false */
async function timedFetch(url: string, init: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const base: RequestInit = {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  };
  try {
    return await fetch(url, base);
  } catch (e) {
    const msg = (e as Error).message || '';
    const tls =
      /certificate|SSL|TLS|CERT|unable to verify|self.signed|UNABLE_TO_VERIFY/i.test(msg);
    if (!tls) throw e;
    const dispatcher = await getInsecureDispatcher();
    if (!dispatcher) throw e;
    console.warn('[challenge] TLS broken, retry insecure:', url);
    // undici dispatcher не в типах DOM RequestInit
    return await fetch(url, { ...base, dispatcher } as RequestInit & { dispatcher: unknown });
  }
}

/** Извлекает toNumbers("...") триплет a/b/c из HTML челленджа */
function extractAesParams(html: string): { a: string; b: string; c: string } | null {
  const m = html.match(/toNumbers\("([0-9a-f]+)"\)\s*,\s*b=toNumbers\("([0-9a-f]+)"\)\s*,\s*c=toNumbers\("([0-9a-f]+)"\)/i);
  if (!m) return null;
  return { a: m[1], b: m[2], c: m[3] };
}

/**
 * Решает slowAES cookie-challenge:
 * скачивает aes.js источника, исполняет в песочнице, возвращает значение cookie __test.
 */
async function solveAesChallenge(origin: string, html: string): Promise<string | null> {
  const params = extractAesParams(html);
  if (!params) return null;

  // 1. Скачиваем aes.js с того же origin
  const aesRes = await timedFetch(`${origin}/aes.js`, {
    headers: { 'User-Agent': BROWSER_UA, Referer: `${origin}/` },
  }, 8000);
  if (!aesRes.ok) return null;
  const aesCode = await aesRes.text();

  // 2. Исполняем slowAES в изолированном vm-контексте (аналог браузерного <script>)
  const sandbox: Record<string, unknown> = { console };
  vm.createContext(sandbox);
  vm.runInContext(aesCode, sandbox, { timeout: 5000 });

  const result = vm.runInContext(
    `(function(){
       function toNumbers(d){var e=[];d.replace(/(..)/g,function(x){e.push(parseInt(x,16))});return e}
       var dec = slowAES.decrypt(toNumbers(${JSON.stringify(params.c)}), 2, toNumbers(${JSON.stringify(params.a)}), toNumbers(${JSON.stringify(params.b)}));
       // Браузерный toHex() склеивает hex-представление каждого байта массива
       var out = ""; for (var i = 0; i < dec.length; i++) { out += (dec[i] < 16 ? "0" : "") + dec[i].toString(16); }
       return out.toLowerCase();
     })()`,
    sandbox,
    { timeout: 5000 },
  );

  return typeof result === 'string' && result.length > 0 ? result : null;
}

/**
 * Решает proof-of-work challenge ("Проверка браузера"):
 * подбираем nonce так, чтобы SHA-256(seed+nonce) начинался с "0000".
 */
function solvePow(html: string): string | null {
  const seedMatch = html.match(/seed\s*=\s*"([0-9a-f]+)"/i);
  const prefixMatch = html.match(/startsWith\(['"](0+)['"]\)/);
  if (!seedMatch) return null;
  const seed = seedMatch[1];
  const zeros = (prefixMatch?.[1] ?? '0000').length;
  const target = '0'.repeat(zeros);

  for (let nonce = 0; nonce < 5_000_000; nonce++) {
    const hex = createHash('sha256').update(seed + nonce).digest('hex');
    if (hex.startsWith(target)) {
      return `${seed}:${nonce}`;
    }
  }
  return null;
}

/** Определяет тип challenge по HTML */
export type ChallengeKind = 'aes' | 'pow' | 'none';

export function detectChallenge(html: string): ChallengeKind {
  if (/slowAES\.decrypt/.test(html) || /src="\/aes\.js"/.test(html)) return 'aes';
  if (/ddos_pow|crypto\.subtle\.digest/.test(html)) return 'pow';
  return 'none';
}

/**
 * Главный вход: получает страницу с учётом всех JS-защит.
 * Возвращает финальный HTML или бросает ошибку, если источник недоступен.
 */
export async function fetchWithChallenge(url: string): Promise<{ html: string; finalUrl: string }> {
  const origin = new URL(url).origin;
  const baseHeaders: Record<string, string> = {
    'User-Agent': BROWSER_UA,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ru,en;q=0.9',
  };

  let currentUrl = url;
  let cookie = solved.get(origin) ?? '';

  // До 4 шагов: challenge -> cookie -> redirect -> pow -> cookie -> контент
  for (let step = 0; step < 4; step++) {
    const headers: Record<string, string> = { ...baseHeaders };
    if (cookie) headers.Cookie = cookie;

    const res = await timedFetch(currentUrl, { headers, redirect: 'manual' });
    const body = await res.text();

    // Редирект источника (?i=1 -> ?i=2 ...)
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (loc) {
        currentUrl = new URL(loc, currentUrl).toString();
        continue;
      }
    }

    const kind = detectChallenge(body);

    if (kind === 'aes') {
      const testCookie = await solveAesChallenge(origin, body);
      if (!testCookie) throw new Error(`Не удалось решить AES-challenge (${origin})`);
      cookie = cookie ? `${cookie}; __test=${testCookie}` : `__test=${testCookie}`;
      solved.set(origin, cookie);
      // Браузер после установки cookie делает location.href = url?i=N
      const next = body.match(/location\.href="([^"]+)"/);
      currentUrl = next ? new URL(next[1], currentUrl).toString() : currentUrl;
      continue;
    }

    if (kind === 'pow') {
      const powValue = solvePow(body);
      if (!powValue) throw new Error(`Не удалось решить PoW-challenge (${origin})`);
      cookie = cookie ? `${cookie}; ddos_pow=${powValue}` : `ddos_pow=${powValue}`;
      solved.set(origin, cookie);
      // Браузер делает location.reload()
      continue;
    }

    // Челленджей нет — это реальный контент страницы
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} от ${currentUrl}`);
    }
    return { html: body, finalUrl: currentUrl };
  }

  throw new Error(`Слишком много challenge-шагов для ${url}`);
}
