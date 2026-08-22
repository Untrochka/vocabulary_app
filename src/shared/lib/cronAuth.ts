// Vercel Cron sends this header itself on each call when CRON_SECRET is set —
// this way the morning/evening ping can't be triggered manually by an outside request.
export function isAuthorizedCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
