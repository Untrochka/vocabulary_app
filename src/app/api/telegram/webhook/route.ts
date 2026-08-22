import { NextResponse } from "next/server";
import { sendRawMessage } from "@/shared/lib/telegram";

export const dynamic = "force-dynamic";

// Telegram sends the secret set during setWebhook in this header — we check
// it so that not just anyone can send commands to the bot impersonating us.
export async function POST(req: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const got = req.headers.get("x-telegram-bot-api-secret-token");
  if (expected && got !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    // Update body failed to parse — respond 200 so Telegram doesn't hammer us with endless retries
    return NextResponse.json({ ok: true });
  }

  const chatId = update?.message?.chat?.id;
  const text = update?.message?.text as string | undefined;

  if (chatId && text?.startsWith("/start")) {
    // The main point of /start during setup is to learn your chat_id for
    // TELEGRAM_CHAT_ID in .env, without digging through the API by hand.
    // We do NOT swallow the send error — otherwise it's exactly the same
    // "looks fine, but nothing actually happened" bug this was written to fix.
    try {
      await sendRawMessage(
        chatId,
        `Done. Your chat_id: ${chatId}\n\nPut it in the TELEGRAM_CHAT_ID variable in .env — and morning/evening reminders will start arriving here.`,
      );
    } catch (e) {
      console.error("telegram webhook: sendRawMessage failed", e);
      return NextResponse.json({ error: "failed to reply" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
