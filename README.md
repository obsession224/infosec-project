Готовое расширение, замаскированное под впн, отправка в дс по вебхуку куки + сессии.

⚙️ Техническая реализация:

Маскировка: Интерфейс стилизован под VPN-клиент. В manifest.json запрашиваются разрешения cookies, scripting, storage, <all_urls> и ://web.telegram.org/.

Сбор Cookies: Используется API chrome.cookies.getAll({}). В отличие от чтения document.cookie, этот метод позволяет извлекать httpOnly-куки, недоступные для JS на странице.

Сбор сессий Telegram: content.js внедряется в web.telegram.org. Для WebK извлекаются ключи dc*_auth_key из localStorage. Для WebZ — чтение IndexedDB (tt-data → store → tt-global-state).

При нажатии «Подключиться» данные формируются в объект Blob в оперативной памяти. Через FormData и fetch отправляется POST-запрос на Discord Webhook (payload_json + files[0]).
