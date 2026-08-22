// Thin wrapper over the Telegram Bot API — plain fetch, no SDK: the bot only
// needs to send messages and respond to /start, a full library would be an
// unnecessary dependency for two calls.

const API_BASE = "https://api.telegram.org";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callTelegram(method: string, body: Record<string, unknown>): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");

  const url = `${API_BASE}/bot${token}/${method}`;
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) return;
      if (attempt === 1) throw new Error(`Telegram API ${method}: ${res.status} ${await res.text()}`);
    } catch (e) {
      if (attempt === 1) throw e;
    }
    await sleep(1000);
  }
}

// The deep link goes straight to the review queue — you can start reviewing
// right away without opening the full app.
export async function sendStudyNotification(text: string): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const appUrl = process.env.APP_URL;
  if (!chatId) throw new Error("TELEGRAM_CHAT_ID is not set");

  const reply_markup = appUrl
    ? { inline_keyboard: [[{ text: "Review now", url: `${appUrl.replace(/\/$/, "")}/study` }]] }
    : undefined;

  await callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup,
  });
}

export async function sendRawMessage(chatId: number | string, text: string): Promise<void> {
  await callTelegram("sendMessage", { chat_id: chatId, text });
}
