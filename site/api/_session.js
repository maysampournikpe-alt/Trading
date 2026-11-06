const crypto = require("crypto");
const NAME = /^[a-z0-9_]{3,20}$/;
function secret() {
  const s = process.env.SESSION_SECRET || "";
  if (s.length < 32) throw Object.assign(new Error("Server is not set up: SESSION_SECRET (32+ characters) is missing"), { status: 503 });
  return s;
}
const sign = v => crypto.createHmac("sha256", secret()).update(v).digest("base64url");
function makeToken(user) { const p = `${user}.${Date.now() + 7 * 864e5}`; return `${p}.${sign(p)}`; }
function cookie(token) { return `sid=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${token ? 604800 : 0}`; }
function userFrom(req) {
  const m = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || "");
  if (!m) return null;
  const t = decodeURIComponent(m[1]).split(".");
  if (t.length !== 3 || !NAME.test(t[0])) return null;
  const good = Buffer.from(sign(`${t[0]}.${t[1]}`)), got = Buffer.from(t[2]);
  if (good.length !== got.length || !crypto.timingSafeEqual(good, got)) return null;
  return Number(t[1]) > Date.now() ? t[0] : null;
}
const hashPw = (pw, salt) => new Promise((res, rej) =>
  crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => e ? rej(e) : res(k)));
const hits = new Map(); // best-effort per-instance rate limit
function limited(key, max, windowMs) {
  const now = Date.now(), a = (hits.get(key) || []).filter(t => now - t < windowMs);
  a.push(now); hits.set(key, a); return a.length > max;
}
function handler(fn) {
  return async (req, res) => {
    res.setHeader("cache-control", "no-store");
    try { await fn(req, res); }
    catch (e) { res.status(e.status && e.status < 600 ? e.status : 500).json({ error: e.status ? e.message : "server error" }); }
  };
}
module.exports = { secret, NAME, makeToken, cookie, userFrom, hashPw, limited, handler };
