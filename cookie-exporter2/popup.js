const statusEl = document.getElementById('status');
const summaryEl = document.getElementById('summary');
const domainsEl = document.getElementById('domains');
const tgStatusEl = document.getElementById('tgStatus');

// Список «чувствительных» доменов для наглядности
const SENSITIVE_DOMAINS = [
  'google.com', 'mail.google.com', 'accounts.google.com',
  'github.com', 'gitlab.com',
  'netflix.com', 'spotify.com',
  'steamcommunity.com', 'steampowered.com',
  'facebook.com', 'instagram.com',
  'vk.com', 'ok.ru',
  'telegram.org', 'web.telegram.org',
  'sberbank.ru', 'tinkoff.ru', 'alfabank.ru', 'vtb.ru',
  'mail.ru', 'yandex.ru'
];

function setStatus(msg) { statusEl.textContent = msg; }

async function saveToFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({ url, filename, saveAs: true });
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function formatCookies(cookies) {
  return cookies.map(c => [
    `# ${c.domain}${c.path}`,
    `name=${c.name}`,
    `value=${c.value}`,
    `domain=${c.domain}`,
    `path=${c.path}`,
    `secure=${c.secure}`,
    `httpOnly=${c.httpOnly}`,
    `sameSite=${c.sameSite}`,
    `expirationDate=${c.expirationDate || 'session'}`,
    ''
  ].join('\n')).join('\n');
}

function groupByDomain(cookies) {
  const map = new Map();
  for (const c of cookies) {
    const d = c.domain.replace(/^\./, '');
    if (!map.has(d)) map.set(d, { total: 0, httpOnly: 0, sensitive: false });
    const entry = map.get(d);
    entry.total++;
    if (c.httpOnly) entry.httpOnly++;
    if (SENSITIVE_DOMAINS.some(sd => d === sd || d.endsWith('.' + sd))) {
      entry.sensitive = true;
    }
  }
  return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
}

async function renderPreview() {
  try {
    const cookies = await chrome.cookies.getAll({});
    const domains = groupByDomain(cookies);
    const httpOnlyCount = cookies.filter(c => c.httpOnly).length;
    const sensitiveCount = domains.filter(([, i]) => i.sensitive).length;

    summaryEl.innerHTML =
      `Всего cookies: <b>${cookies.length}</b><br>` +
      `Из них <span class="http-only">httpOnly</span>: <b>${httpOnlyCount}</b><br>` +
      `Доменов: <b>${domains.length}</b><br>` +
      `Чувствительных доменов: <b class="sensitive">${sensitiveCount}</b>`;

    domainsEl.innerHTML = '';
    for (const [domain, info] of domains.slice(0, 25)) {
      const row = document.createElement('div');
      row.className = 'domain-row';
      const domainSpan = info.sensitive
        ? `<span class="sensitive">${domain} ⚠</span>`
        : `<span>${domain}</span>`;
      row.innerHTML = domainSpan + `<span>${info.total}` +
        (info.httpOnly ? ` <span class="http-only">(${info.httpOnly} httpOnly)</span>` : '') +
        `</span>`;
      domainsEl.appendChild(row);
    }
    if (domains.length > 25) {
      const more = document.createElement('div');
      more.className = 'domain-row';
      more.textContent = `... и ещё ${domains.length - 25} доменов`;
      domainsEl.appendChild(more);
    }
  } catch (e) {
    summaryEl.textContent = 'Ошибка: ' + e.message;
  }
}

async function refreshTelegramStatus() {
  const data = await chrome.storage.local.get('telegramAuth');
  const auth = data.telegramAuth;
  if (!auth || !auth.version) {
    tgStatusEl.textContent = 'Сессия не найдена. Откройте web.telegram.org и войдите.';
    return null;
  }
  const keyCount = Object.keys(auth.keys || {}).length;
  tgStatusEl.textContent = `Версия: ${auth.version}\n` +
    (auth.version === 'WebK'
      ? `Найдено ключей: ${keyCount}`
      : `tt-global-state: ${auth.webzState ? 'прочитан' : 'пусто'}`);
  return auth;
}

document.getElementById('exportAll').addEventListener('click', async () => {
  setStatus('Читаю cookies...');
  try {
    const cookies = await chrome.cookies.getAll({});
    const domains = groupByDomain(cookies);
    const header = `# Экспорт cookies (${new Date().toISOString()})\n# Всего: ${cookies.length}\n# Доменов: ${domains.length}\n# ТОП:\n` +
      domains.slice(0, 15).map(([d, i]) => `#   ${d}: ${i.total}`).join('\n') + '\n\n';
    await saveToFile(header + formatCookies(cookies), `cookies_all_${Date.now()}.txt`);
    setStatus(`Сохранено ${cookies.length} cookies.`);
  } catch (e) { setStatus('Ошибка: ' + e.message); }
});

document.getElementById('exportCurrent').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) { setStatus('Нет активной вкладки.'); return; }
  const host = new URL(tab.url).hostname;
  const cookies = await chrome.cookies.getAll({ domain: host });
  if (!cookies.length) { setStatus('Нет cookies для ' + host); return; }
  await saveToFile(`# Cookies для ${host}\n\n` + formatCookies(cookies), `cookies_${host}_${Date.now()}.txt`);
  setStatus(`Сохранено ${cookies.length} cookies для ${host}.`);
});

document.getElementById('checkTg').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.url || !tab.url.includes('web.telegram.org')) {
    tgStatusEl.textContent = 'Откройте web.telegram.org.';
    return;
  }
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  await new Promise(r => setTimeout(r, 800));
  await refreshTelegramStatus();
});

document.getElementById('exportTg').addEventListener('click', async () => {
  const auth = await refreshTelegramStatus();
  if (!auth) return;
  let content = `# Telegram Web Session (${auth.version})\n# Date: ${new Date().toISOString()}\n# WARNING: локальный учебный файл.\n\n`;
  if (auth.version === 'WebK') {
    content += Object.entries(auth.keys).map(([k, v]) => `${k}=${v}`).join('\n');
  } else {
    content += `# tt-global-state (WebZ IndexedDB):\n` + JSON.stringify(auth.webzState, null, 2);
  }
  await saveToFile(content, `telegram_session_${Date.now()}.txt`);
  setStatus('Сессия Telegram сохранена.');
});

document.getElementById('exportEverything').addEventListener('click', async () => {
  setStatus('Собираю всё...');
  const cookies = await chrome.cookies.getAll({});
  const domains = groupByDomain(cookies);
  const tgData = await chrome.storage.local.get('telegramAuth');
  const tgAuth = tgData.telegramAuth;

  let header = `# ОБЩИЙ ЭКСПОРТ — ${new Date().toISOString()}\n#\n# === COOKIES ===\n# Всего: ${cookies.length}, доменов: ${domains.length}\n# ТОП:\n` +
    domains.slice(0, 15).map(([d, i]) => `#   ${d}: ${i.total}`).join('\n') + '\n';

  let tgSection = '\n# === TELEGRAM ===\n';
  if (tgAuth && tgAuth.version) {
    tgSection += `# Версия: ${tgAuth.version}\n`;
    if (tgAuth.version === 'WebK') {
      tgSection += Object.entries(tgAuth.keys).map(([k, v]) => `${k}=${v}`).join('\n');
    } else {
      tgSection += `# tt-global-state:\n` + JSON.stringify(tgAuth.webzState, null, 2);
    }
  } else {
    tgSection += '# Сессия не найдена\n';
  }

  await saveToFile(header + '\n' + formatCookies(cookies) + tgSection, `full_export_${Date.now()}.txt`);
  setStatus(`Готово. Cookies: ${cookies.length}, Telegram: ${tgAuth?.version || 'нет'}.`);
});

// ============ ИМПОРТ COOKIES ============

function parseCookiesFile(text) {
  const cookies = [];
  let currentCookie = null;
  const lines = text.split('\n');
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    if (line.startsWith('#')) {
      if (currentCookie && currentCookie.name && currentCookie.value !== undefined) {
        cookies.push(currentCookie);
      }
      currentCookie = {};
      continue;
    }

    if (currentCookie) {
      const eq = line.indexOf('=');
      if (eq !== -1) {
        const key = line.substring(0, eq).trim();
        const value = line.substring(eq + 1).trim();
        currentCookie[key] = value;
      }
    }
  }

  if (currentCookie && currentCookie.name && currentCookie.value !== undefined) {
    cookies.push(currentCookie);
  }

  return cookies.filter(c => c.name && c.value !== undefined && c.domain);
}

document.getElementById('importCookies').addEventListener('click', async () => {
  const fileInput = document.getElementById('importFile');
  const file = fileInput.files[0];
  if (!file) { setStatus('Выбери файл для импорта.'); return; }

  setStatus('Читаю файл...');
  try {
    const text = await file.text();
    const parsed = parseCookiesFile(text);
    if (!parsed.length) {
      setStatus('В файле не найдено cookies (или формат не распознан).');
      return;
    }

    let success = 0, failed = 0;
    for (const c of parsed) {
      const details = {
        url: `${c.secure === 'true' ? 'https' : 'http'}://${c.domain.replace(/^\./, '')}${c.path || '/'}`,
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path || '/',
        secure: c.secure === 'true',
        httpOnly: c.httpOnly === 'true',
        sameSite: c.sameSite || 'unspecified'
      };
      if (c.expirationDate && c.expirationDate !== 'session') {
        const exp = parseFloat(c.expirationDate);
        if (!isNaN(exp)) details.expirationDate = exp;
      }
      try {
        await chrome.cookies.set(details);
        success++;
      } catch (e) {
        failed++;
        console.warn('Не удалось установить cookie', c.name, e);
      }
    }
    setStatus(`Импорт завершён. Успешно: ${success}, ошибок: ${failed}.\nОткрой сайт и проверь, залогинен ли ты.`);
    await renderPreview();
  } catch (e) {
    setStatus('Ошибка импорта: ' + e.message);
  }
});

// ============ ИМПОРТ СЕССИИ TELEGRAM ============

document.getElementById('importTg').addEventListener('click', async () => {
  const fileInput = document.getElementById('importTgFile');
  const file = fileInput.files[0];
  if (!file) { setStatus('Выбери файл сессии Telegram.'); return; }

  setStatus('Читаю файл Telegram...');
  try {
    const text = await file.text();
    const tgKeys = {};
    
    // Ищем в файле строки с ключами Telegram
    const lines = text.split('\n');
    for (let line of lines) {
      line = line.trim();
      if ((line.startsWith('dc') && line.includes('_auth_key')) || line.startsWith('user_auth')) {
        const eq = line.indexOf('=');
        if (eq !== -1) {
          const key = line.substring(0, eq).trim();
          const value = line.substring(eq + 1).trim();
          tgKeys[key] = value;
        }
      }
    }

    if (Object.keys(tgKeys).length === 0) {
      setStatus('В файле не найдены ключи Telegram (dc*_auth_key).');
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url || !tab.url.includes('web.telegram.org')) {
      setStatus('Открой вкладку web.telegram.org/k/ и нажми кнопку снова.');
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (keys) => {
        for (const [k, v] of Object.entries(keys)) {
          localStorage.setItem(k, v);
        }
        return Object.keys(keys).length;
      },
      args: [tgKeys]
    });

    setStatus(`Импортировано ключей Telegram: ${Object.keys(tgKeys).length}.\nОбнови страницу (F5) — ты должен войти в аккаунт.`);
  } catch (e) {
    setStatus('Ошибка импорта ТГ: ' + e.message);
  }
});

renderPreview();
refreshTelegramStatus();