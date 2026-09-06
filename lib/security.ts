import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from "node:crypto";
import Redis from "ioredis";
let redis: Redis | undefined;
export function cache() {
  if (!process.env.REDIS_URL) throw new Error("Redis is not configured.");
  return (redis ??= new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
  }));
}
export async function rateLimit(key: string, limit: number, seconds: number) {
  const n = (await cache().eval(
    "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
    1,
    "rr:" + key,
    seconds,
  )) as number;
  if (n > limit)
    throw new Error("Rate limit reached. Please wait before trying again.");
}
function key() {
  const value = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value))
    throw new Error("Integration encryption is not configured.");
  return Buffer.from(value, "hex");
}
export function encrypt(value: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  return Buffer.concat([
    iv,
    cipher.update(value),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
}
export function decrypt(value: string) {
  const b = Buffer.from(value, "base64"),
    dec = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  dec.setAuthTag(b.subarray(-16));
  return Buffer.concat([
    dec.update(b.subarray(12, -16)),
    dec.final(),
  ]).toString();
}
export function safeEqual(a: string, b: string) {
  return (
    a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
export function discordURL(value: string) {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.hostname !== "discord.com" ||
    u.port ||
    u.username ||
    u.password ||
    !/^\/api\/webhooks\/\d+\/[\w-]+$/.test(u.pathname) ||
    u.search ||
    u.hash
  )
    throw new Error("Use a Discord webhook URL from discord.com.");
  return u.toString();
}
export function sameOrigin(req: Request) {
  const expected = new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ).origin;
  if (req.headers.get("origin") !== expected)
    throw new Error("Request origin rejected.");
}
